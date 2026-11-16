
    const $ = (selector, root = document) => root.querySelector(selector);
    const E = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
    const v = (id) => $('#' + id).value;

    const DEFAULT_BASE = 'http://localhost:8080';
    const state = {
      base: DEFAULT_BASE,
      logs: [],
      answers: {}
    };

    try {
      state.base = localStorage.getItem('qb') || state.base;
    } catch (_) {}

    function setBase(value) {
      state.base = String(value || '').trim().replace(/\/$/, '');
      try {
        localStorage.setItem('qb', state.base);
      } catch (_) {}
      render();
    }

    function toast(message, isError = false) {
      const toastNode = $('#ts');
      toastNode.textContent = message;
      toastNode.style.display = 'block';
      toastNode.style.background = isError ? 'var(--bad)' : 'var(--ink)';
      clearTimeout(toastNode.h);
      toastNode.h = setTimeout(() => {
        toastNode.style.display = 'none';
      }, 3500);
    }

    const show = (data) => {
      const output = $('#out');
      if (output) {
        output.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      }
    };

    const go = (fn) => Promise.resolve().then(fn).catch((error) => {
      if (!(error && 'st' in error)) {
        toast(error.message || String(error), true);
      }
    });

    const redo = async (payload) => {
      await render();
      show(payload);
    };

    async function api(method, path, body) {
      const url = state.base + '/api/v1' + path;
      const startedAt = performance.now();
      const options = { method };
      let status = 0;
      let data;

      if (body !== undefined) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
      }

      try {
        const response = await fetch(url, options);
        status = response.status;
        const raw = await response.text();
        try {
          data = JSON.parse(raw);
        } catch (_) {
          data = raw;
        }
      } catch (error) {
        data = 'Network error: ' + error.message + '. Check that the server is running and CORS allows this origin.';
      }

      state.logs.unshift({
        method,
        url,
        body,
        status,
        data,
        ms: Math.round(performance.now() - startedAt)
      });
      state.logs.length = Math.min(state.logs.length, 40);
      drawLog();

      if (status < 200 || status >= 300) {
        toast((status || 'ERR') + ' ' + method + ' ' + path, true);
        show((status || 'ERR') + '\n' + (typeof data === 'string' ? data : JSON.stringify(data, null, 2)));
        throw { status, data };
      }

      return data;
    }

    function drawLog() {
      const latest = state.logs[0];
      $('#cc').textContent = latest ? `(${latest.method} ${latest.status || 'ERR'})` : '';
      $('#cl').innerHTML = state.logs.map((entry) => {
        const isSuccess = entry.status >= 200 && entry.status < 300;
        const requestText = entry.body !== undefined ? 'Request\n' + JSON.stringify(entry.body, null, 1) + '\n\n' : '';
        const responseText = typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data, null, 1);
        return `<details><summary><b>${entry.method}</b> ${E(entry.url.replace(state.base, ''))} <i class="${isSuccess ? 'ok' : 'bad'}">${entry.status || 'ERR'}</i> ${entry.ms}ms</summary><pre>${E(requestText + 'Response\n' + responseText)}</pre></details>`;
      }).join('') || '<span class=mut>Requests will appear here.</span>';
    }

    function renderTable(headers, rows) {
      if (!rows.length) {
        return '<p class=mut>Nothing here yet.</p>';
      }

      return `<div class=tw><table><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}</table></div>`;
    }

    function renderGrid(rows) {
      if (!rows.length) {
        return '<p class=mut>No rows returned.</p>';
      }

      return renderTable(
        Object.keys(rows[0]).map((key) => E(key)),
        rows.map((row) => Object.values(row).map((value) => E(value && typeof value === 'object' ? JSON.stringify(value) : value)))
      );
    }

    const opts = (topics) => topics.map((topic) => `<option value=${topic.id}>${E(topic.name)}</option>`).join('');

    const chips = (result, includeAll = false) => {
      $('#res').innerHTML = '<div class=row>' + Object.entries(result || {}).filter(([key, value]) => typeof value === 'number' && (includeAll || /score|correct|wrong|unanswered/i.test(key))).map(([key, value]) => `<span class=chip>${E(key)}: <b>${value}</b></span>`).join('') + '</div>';
    };

    const loc = (deltaMs) => new Date(Date.now() + deltaMs - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    const topicsList = async () => (await api('GET', '/topics')).topics || [];

    async function render() {
      const [routeName, id] = (location.hash || '#topics').slice(1).split('/');
      $('#bu').value = state.base;
      document.querySelectorAll('nav a').forEach((link) => {
        const target = link.getAttribute('href').slice(1);
        link.classList.toggle('on', target === (routeName === 'exam' ? 'exams' : routeName));
      });

      const handlers = {
        topics: vTopics,
        questions: vQuestions,
        exams: vExams,
        exam: () => vExam(id),
        students: vStudents,
        attempts: vAttempts
      };

      await go(() => (handlers[routeName] || vTopics)());
    }

    async function vTopics() {
      const topics = await topicsList();
      $('#main').innerHTML = '<h2>Topics</h2>' +
        '<div class=row><input id=tn placeholder="Name"><input id=td class=w placeholder="Description"><button onclick="go(addTopic)">Create topic</button></div>' +
        renderTable(['ID', 'Name', 'Description', ''], topics.map((topic) => [
          topic.id,
          E(topic.name),
          E(topic.description),
          `<button class=g onclick="go(()=>upd(${topic.id},'name','newName','New name'))">Rename</button><button class=g onclick="go(()=>upd(${topic.id},'desc','newDesc','New description'))">Edit description</button>`
        ])) +
        '<pre id=out></pre>';
    }

    const addTopic = async () => redo(await api('POST', '/topics', {
      name: v('tn'),
      description: v('td')
    }));

    async function upd(id, sub, key, label) {
      const nextValue = prompt(label);
      if (!nextValue) return;
      return redo(await api('PUT', `/topics/${id}/${sub}`, { [key]: nextValue }));
    }

    let QS = { topicId: '', query: '', size: 5, page: 0 };

    async function vQuestions() {
      const topics = await topicsList();
      if (!QS.topicId && topics[0]) QS.topicId = topics[0].id;

      $('#main').innerHTML = '<h2>Questions</h2>' +
        '<div class=row><select id=qt>' + opts(topics) + '</select><input id=qq class=w placeholder="Exact text match (optional)" value="' + E(QS.query) + '"><input id=qs type=number min=1 value=' + QS.size + ' style="width:70px" aria-label="Page size"><button onclick="go(()=>qList(0))">List questions</button></div>' +
        '<div id=ql></div>' +
        '<h3>Create question</h3><div class=row><input id=nt class=w placeholder="Question text"><button onclick="go(addQ)">Create in selected topic</button></div>' +
        '<h3>Find by ID</h3><div class=row><input id=gid type=number placeholder="Question ID"><button class=g onclick="go(()=>showQ(v(\'gid\')))">Get question</button></div><pre id=out></pre>';

      if (QS.topicId) {
        $('#qt').value = QS.topicId;
        await qList(QS.page);
      } else {
        $('#ql').innerHTML = '<p class=mut>Create a topic first, then add questions to it.</p>';
      }
    }

    async function qList(page) {
      QS = {
        topicId: v('qt'),
        query: v('qq'),
        size: +v('qs') || 5,
        page
      };

      const data = await api('GET', `/questions?topicId=${QS.topicId}&page=${QS.page}&size=${QS.size}` + (QS.query ? '&q=' + encodeURIComponent(QS.query) : ''));
      const content = data.content || [];

      $('#ql').innerHTML = renderTable(['ID', 'Text', 'Difficulty', ''], content.map((question) => [
        question.id,
        E(question.text),
        E(question.difficulty),
        `<button class=g onclick="go(()=>showQ(${question.id}))">View</button><button class=g onclick="go(()=>editQ(${question.id}))">Edit</button><button class=g onclick="go(()=>delQ(${question.id}))">Delete</button>`
      ])) +
      `<div class=row><button class=g ${QS.page < 1 ? 'disabled' : ''} onclick="go(()=>qList(${QS.page - 1}))">Previous</button><span>Page ${QS.page + 1} of ${data.totalPages || 1}</span><button class=g ${data.last ? 'disabled' : ''} onclick="go(()=>qList(${QS.page + 1}))">Next</button></div>`;
    }

    const showQ = async (id) => show(await api('GET', '/questions/' + id));
    const addQ = async () => redo(await api('POST', '/questions', {
      text: v('nt'),
      topic: { id: +v('qt') }
    }));

    async function editQ(id) {
      const nextValue = prompt('New question text');
      if (!nextValue) return;
      return redo(await api('PUT', '/questions/' + id, nextValue));
    }

    async function delQ(id) {
      if (!confirm('Delete question ' + id + '?')) return;
      return redo(await api('DELETE', '/questions/' + id));
    }

    async function vExams() {
      const response = await api('GET', '/exams');
      const exams = Array.isArray(response) ? response : response.exams || [];

      $('#main').innerHTML = '<h2>Exams</h2>' +
        renderTable(['ID', 'Title', 'Status', 'Minutes', 'Max attempts', ''], exams.map((exam) => [
          exam.id,
          E(exam.title),
          E(exam.examStatus || exam.status),
          Math.round(exam.durationSeconds / 60),
          exam.maxAttempts,
          `<a class=b href="#exam/${exam.id}">Open</a><button class=g onclick="go(()=>pub(${exam.id}))">Publish</button><button class=g onclick="go(()=>delE(${exam.id}))">Delete</button>`
        ])) +
        '<h3>Create exam</h3><div class=grid>' +
        '<label>Title<input id=et></label><label>Duration (seconds)<input id=ed type=number value=1800></label>' +
        '<label>Opens<input id=eo type=datetime-local value="' + loc(0) + '"></label><label>Closes<input id=ec type=datetime-local value="' + loc(864e5) + '"></label>' +
        '<label>Max attempts<input id=em type=number value=1></label><label>Score per question<input id=es type=number value=1></label>' +
        '<label>Penalty per wrong<input id=ep type=number value=0></label><label>Created by<input id=eb value="teacher-1"></label>' +
        '<label>Status<select id=ex><option>DRAFT<option>PUBLISHED<option>CLOSED</select></label><label class=ck><input id=en type=checkbox>Negative marking</label></div>' +
        '<div class=row><button onclick="go(addE)">Create exam</button></div><pre id=out></pre>';
    }

    const addE = async () => redo(await api('POST', '/exams', {
      title: v('et'),
      durationSeconds: +v('ed'),
      opensAt: new Date(v('eo')).toISOString(),
      closesAt: new Date(v('ec')).toISOString(),
      maxAttempts: +v('em'),
      negativeMarking: $('#en').checked,
      penaltyPerWrong: +v('ep'),
      examStatus: v('ex'),
      createdBy: v('eb'),
      scorePerQuestion: +v('es')
    }));

    const pub = async (id) => redo(await api('POST', `/exams/${id}/publish`));

    async function delE(id, back) {
      if (!confirm('Delete exam ' + id + '?')) return;
      const data = await api('DELETE', '/exams/' + id);
      if (back) {
        location.hash = '#exams';
      } else {
        return redo(data);
      }
    }

    async function vExam(id) {
      const [exam, topics] = await Promise.all([api('GET', '/exams/' + id), topicsList()]);

      $('#main').innerHTML = '<p><a href="#exams">All exams</a></p><h2>' + E(exam.title) + '<span class=tag>ID ' + id + '</span><span class=tag>' + E(exam.examStatus || exam.status) + '</span></h2>' +
        '<div class=row><button onclick="go(()=>pub(' + id + '))">Publish</button><button class=g onclick="go(()=>board(' + id + '))">Leaderboard</button><button class=g onclick="go(()=>stats(' + id + '))">Topic analytics</button><button class=g onclick="go(()=>delE(' + id + ',1))">Delete exam</button></div><div id=res></div>' +
        '<h3>Add a question</h3><div class=row><input id=aq class=w placeholder="Question text"><select id=at aria-label="Topic">' + opts(topics) + '</select><select id=ad aria-label="Difficulty"><option value="">No difficulty<option>EASY<option>AVERAGE<option>HARD</select></div>' +
        ['A','B','C','D'].map((letter) => `<div class=row><b>${letter}</b><input id=o${letter} class=w placeholder="Option ${letter}"><label class=ck><input type=radio name=ok value=${letter}>Correct</label></div>`).join('') +
        '<div class=row><button onclick="go(()=>addEQ(' + id + '))">Add to exam</button></div><pre id=out></pre>';
    }

    async function addEQ(id) {
      const selectedKey = document.querySelector('input[name=ok]:checked')?.value;
      const question = { text: v('aq'), topic: { id: +v('at') } };
      if (v('ad')) question.difficulty = v('ad');

      const options = ['A','B','C','D']
        .filter((letter) => v('o' + letter).trim())
        .map((letter) => ({ text: v('o' + letter), label: letter, isCorrect: selectedKey == letter }));

      const data = await api('PUT', `/exams/${id}/questions`, { question, options });
      ['aq','oA','oB','oC','oD'].forEach((inputId) => $('#' + inputId).value = '');
      show(data);
    }

    async function board(id) {
      const data = await api('GET', `/exams/${id}/leaderboard`);
      $('#res').innerHTML = '<h3>Leaderboard</h3>' + renderGrid(data.positions || []);
    }

    async function stats(id) {
      const data = await api('GET', `/exams/${id}/analytics/topics`);
      chips({ ...data.attempts, ...data.scores }, true);
      $('#res').insertAdjacentHTML('beforeend', '<h3>Topics</h3>' + renderGrid(data.topics || []));
    }

    function vStudents() {
      $('#main').innerHTML = '<h2>Students</h2><div class=row><input id=sn placeholder="Full name"><input id=se placeholder="Email"><input id=sp type=password placeholder="Password"><button onclick="go(addS)">Create student</button></div>' +
        '<div class=row><input id=si type=number placeholder="Student ID"><button class=g onclick="go(async()=>show(await api(\'GET\',\'/students/\'+v(\'si\'))))">Get student</button><button class=g onclick="go(attS)">List attempts</button></div><div id=res></div><pre id=out></pre>';
    }

    async function addS() {
      const data = await api('POST', '/students', {
        fullname: v('sn'),
        email: v('se'),
        password: v('sp')
      });
      show(data);
      $('#si').value = data.student?.id ?? '';
    }

    async function attS() {
      const data = await api('GET', `/students/${v('si')}/attempts`);
      $('#res').innerHTML = renderGrid(data.attempts || []);
    }

    function vAttempts() {
      state.answers = {};
      $('#main').innerHTML = '<h2>Attempts</h2><h3>Start an attempt</h3>' +
        '<div class=row><input id=xe type=number placeholder="Exam ID"><input id=xs type=number placeholder="Student ID"><button onclick="go(start)">Start attempt</button></div>' +
        '<label class=ck><input id=sw type=checkbox checked>Question ID comes back as examQuestionId (swapped in the current DTO)</label>' +
        '<p class=mut>The current start route never saves the attempt, so it fails until the controller is fixed. You can still test the other routes below with an attempt ID from the database.</p>' +
        '<div id=qz></div><h3>Work with an attempt</h3>' +
        '<div class=row><input id=ai type=number placeholder="Attempt ID"><button class=g onclick="go(()=>one(\'\'))">Get attempt</button><button class=g onclick="go(()=>one(\'/result\'))">Result</button><button class=g onclick="go(()=>one(\'/analytics/topics\'))">Topic analytics</button></div>' +
        '<textarea id=an rows=5 spellcheck=false>{"answers":[{"questionId":0,"selectedOptionId":0}]}</textarea>' +
        '<div class=row><button onclick="go(()=>send(\'PUT\',\'/answers\'))">Save answers</button><button onclick="go(()=>send(\'POST\',\'/submit\'))">Submit attempt</button></div><div id=res></div><pre id=out></pre>';
    }

    async function start() {
      const response = await api('POST', `/exams/${v('xe')}/attempts`, { studentId: +v('xs') });
      $('#ai').value = response.attemptId ?? response.attempId ?? response.id ?? '';
      state.answers = {};

      $('#qz').innerHTML = '<p class=mut>Token ' + E(response.token) + ', expires ' + E(response.expiresAt) + '</p>' +
        (response.questions || response.examQuestions || []).map((question) => {
          const id = $('#sw').checked ? question.examQuestionId : question.questionId;
          return `<div class=q><b>${E(question.text)}</b>${(question.options || []).map((option) => `<label><input type=radio name="q${id}" onchange="pick(${id},${option.id})">${E(option.label)}. ${E(option.text)}</label>`).join('')}</div>`;
        }).join('');

      show(response);
    }

    function pick(questionId, optionId) {
      state.answers[questionId] = optionId;
      $('#an').value = JSON.stringify({
        answers: Object.entries(state.answers).map(([key, value]) => ({ questionId: +key, selectedOptionId: value }))
      }, null, 1);
    }

    async function one(suffix) {
      const data = await api('GET', `/attempts/${v('ai')}${suffix}`);
      chips(data.result || data);
      show(data);
    }

    async function send(method, path) {
      const data = await api(method, `/attempts/${v('ai')}${path}`, JSON.parse(v('an')));
      chips(data.result);
      show(data);
    }

    onhashchange = render;
    drawLog();
    render();
  