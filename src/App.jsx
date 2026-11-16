import { useEffect, useMemo, useState } from 'react';

const DEFAULT_BASE = 'http://localhost:8080';

function App() {
  const [base, setBase] = useState(() => {
    try {
      return localStorage.getItem('qb') || DEFAULT_BASE;
    } catch {
      return DEFAULT_BASE;
    }
  });
  const [route, setRoute] = useState(() => window.location.hash || '#topics');
  const [logs, setLogs] = useState([]);
  const [toast, setToast] = useState({ message: '', error: false });
  const [output, setOutput] = useState('');
  const [topics, setTopics] = useState([]);
  const [questions, setQuestions] = useState({ content: [], totalPages: 1, last: true });
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [resultChips, setResultChips] = useState([]);

  const [topicName, setTopicName] = useState('');
  const [topicDescription, setTopicDescription] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [questionTopicId, setQuestionTopicId] = useState('');
  const [questionMatch, setQuestionMatch] = useState('');
  const [pageSize, setPageSize] = useState(5);
  const [pageIndex, setPageIndex] = useState(0);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [attemptId, setAttemptId] = useState('');
  const [examId, setExamId] = useState('');
  const [examStudentId, setExamStudentId] = useState('');
  const [attemptPayload, setAttemptPayload] = useState('{"answers":[{"questionId":0,"selectedOptionId":0}]}');
  const [attemptQuestions, setAttemptQuestions] = useState([]);
  const [attemptToken, setAttemptToken] = useState('');
  const [attemptExpiry, setAttemptExpiry] = useState('');
  const [answerMap, setAnswerMap] = useState({});

  const routeName = useMemo(() => {
    const [name] = route.replace(/^#/, '').split('/');
    return name || 'topics';
  }, [route]);

  const routeId = useMemo(() => {
    const [, id] = route.replace(/^#/, '').split('/');
    return id || '';
  }, [route]);

  const showToast = (message, isError = false) => {
    setToast({ message, error: isError });
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast({ message: '', error: false }), 3200);
  };

  const addLog = (entry) => {
    setLogs((prev) => [entry, ...prev].slice(0, 40));
  };

  const api = async (method, path, body) => {
    const url = base + '/api/v1' + path;
    const started = performance.now();
    const options = { method };
    let status = 0;
    let data = null;

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
      } catch {
        data = raw;
      }
    } catch (error) {
      data = `Network error: ${error.message}. Check that the server is running and CORS allows this origin.`;
    }

    addLog({
      method,
      url,
      status,
      data,
      ms: Math.round(performance.now() - started),
      body,
    });

    if (status < 200 || status >= 300) {
      const message = (status || 'ERR') + ' ' + method + ' ' + path;
      showToast(message, true);
      setOutput((status || 'ERR') + '\n' + (typeof data === 'string' ? data : JSON.stringify(data, null, 2)));
      throw { status, data };
    }

    return data;
  };

  const reloadTopics = async () => {
    try {
      const response = await api('GET', '/topics');
      const nextTopics = response.topics || [];
      setTopics(nextTopics);
      if (!questionTopicId && nextTopics[0]) setQuestionTopicId(String(nextTopics[0].id));
    } catch {
      setTopics([]);
    }
  };

  const reloadExams = async () => {
    try {
      const response = await api('GET', '/exams');
      setExams(Array.isArray(response) ? response : response.exams || []);
    } catch {
      setExams([]);
    }
  };

  const reloadQuestions = async (nextPage = pageIndex, nextTopic = questionTopicId, nextQuery = questionMatch, size = pageSize) => {
    if (!nextTopic) return;
    try {
      const response = await api('GET', `/questions?topicId=${nextTopic}&page=${nextPage}&size=${size}${nextQuery ? '&q=' + encodeURIComponent(nextQuery) : ''}`);
      setQuestions(response || { content: [], totalPages: 1, last: true });
    } catch {
      setQuestions({ content: [], totalPages: 1, last: true });
    }
  };

  const showResponse = (data) => setOutput(typeof data === 'string' ? data : JSON.stringify(data, null, 2));

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || '#topics');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (routeName === 'topics') reloadTopics();
    if (routeName === 'questions') reloadTopics();
    if (routeName === 'exams') reloadExams();
  }, [routeName]);

  useEffect(() => {
    try {
      localStorage.setItem('qb', base);
    } catch {}
  }, [base]);

  useEffect(() => {
    if (routeName === 'questions') {
      reloadQuestions(pageIndex, questionTopicId, questionMatch, pageSize);
    }
  }, [pageIndex, pageSize, questionTopicId, questionMatch, routeName]);

  const handleCreateTopic = async () => {
    try {
      const response = await api('POST', '/topics', { name: topicName, description: topicDescription });
      setTopicName('');
      setTopicDescription('');
      showResponse(response);
      reloadTopics();
    } catch {}
  };

  const handleEditTopic = async (id, field, label) => {
    const nextValue = window.prompt(label);
    if (!nextValue) return;
    try {
      const response = await api('PUT', `/topics/${id}/${field}`, { [field === 'name' ? 'newName' : 'newDesc']: nextValue });
      showResponse(response);
      reloadTopics();
    } catch {}
  };

  const handleCreateQuestion = async () => {
    try {
      const response = await api('POST', '/questions', { text: questionText, topic: { id: Number(questionTopicId) } });
      setQuestionText('');
      showResponse(response);
      reloadQuestions();
    } catch {}
  };

  const handleCreateExam = async () => {
    try {
      const examPayload = {
        title: document.getElementById('exam-title')?.value || '',
        durationSeconds: Number(document.getElementById('exam-duration')?.value || 1800),
        opensAt: new Date(document.getElementById('exam-open')?.value || new Date()).toISOString(),
        closesAt: new Date(document.getElementById('exam-close')?.value || new Date(Date.now() + 86400000)).toISOString(),
        maxAttempts: Number(document.getElementById('exam-attempts')?.value || 1),
        negativeMarking: document.getElementById('exam-negative')?.checked || false,
        penaltyPerWrong: Number(document.getElementById('exam-penalty')?.value || 0),
        examStatus: document.getElementById('exam-status')?.value || 'DRAFT',
        createdBy: document.getElementById('exam-created')?.value || 'teacher-1',
        scorePerQuestion: Number(document.getElementById('exam-score')?.value || 1),
      };
      const response = await api('POST', '/exams', examPayload);
      showResponse(response);
      reloadExams();
    } catch {}
  };

  const handlePublishExam = async (id) => {
    try {
      const response = await api('POST', `/exams/${id}/publish`);
      showResponse(response);
      reloadExams();
    } catch {}
  };

  const handleDeleteExam = async (id) => {
    if (!window.confirm('Delete exam ' + id + '?')) return;
    try {
      const response = await api('DELETE', `/exams/${id}`);
      showResponse(response);
      reloadExams();
      if (window.location.hash === '#exam/' + id) window.location.hash = '#exams';
    } catch {}
  };

  const handleCreateStudent = async () => {
    try {
      const response = await api('POST', '/students', { fullname: studentName, email: studentEmail, password: studentPassword });
      showResponse(response);
      setStudentId(String(response.student?.id ?? ''));
      setStudentName('');
      setStudentEmail('');
      setStudentPassword('');
    } catch {}
  };

  const handleStudentAttempts = async () => {
    try {
      const response = await api('GET', `/students/${studentId}/attempts`);
      setStudents(response.attempts || []);
      setOutput(JSON.stringify(response, null, 2));
    } catch {}
  };

  const handleStartAttempt = async () => {
    try {
      const response = await api('POST', `/exams/${examId}/attempts`, { studentId: Number(examStudentId) });
      setAttemptId(String(response.attemptId ?? response.attempId ?? response.id ?? ''));
      setAttemptToken(response.token || '');
      setAttemptExpiry(response.expiresAt || '');
      setAttemptQuestions(response.questions || response.examQuestions || []);
      setAnswerMap({});
      setAttemptPayload(JSON.stringify({ answers: [] }, null, 1));
      setOutput(JSON.stringify(response, null, 2));
    } catch {}
  };

  const pickAnswer = (questionId, optionId) => {
    const next = { ...answerMap, [questionId]: optionId };
    setAnswerMap(next);
    setAttemptPayload(JSON.stringify({
      answers: Object.entries(next).map(([key, value]) => ({ questionId: Number(key), selectedOptionId: value })),
    }, null, 1));
  };

  const handleSaveAnswers = async () => {
    try {
      const payload = JSON.parse(attemptPayload);
      const response = await api('PUT', `/attempts/${attemptId}/answers`, payload);
      setResultChips(Array.isArray(response.result) ? response.result : response.result ? [response.result] : []);
      showResponse(response);
    } catch (error) {
      if (error && error.message) showToast(error.message, true);
    }
  };

  const handleSubmitAttempt = async () => {
    try {
      const payload = JSON.parse(attemptPayload);
      const response = await api('POST', `/attempts/${attemptId}/submit`, payload);
      setResultChips(response.result ? Object.entries(response.result).filter(([, value]) => typeof value === 'number').map(([key, value]) => `${key}: ${value}`) : []);
      showResponse(response);
    } catch (error) {
      if (error && error.message) showToast(error.message, true);
    }
  };

  const renderTable = (headers, rows) => {
    if (!rows.length) return <p className="mut">Nothing here yet.</p>;
    return (
      <div className="tw">
        <table>
          <thead>
            <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell ?? ''}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderRoute = () => {
    if (routeName === 'questions') {
      return (
        <>
          <h2>Questions</h2>
          <div className="row">
            <select value={questionTopicId} onChange={(e) => setQuestionTopicId(e.target.value)}>
              {topics.map((topic) => (
                <option key={topic.id} value={String(topic.id)}>{topic.name}</option>
              ))}
            </select>
            <input className="w" placeholder="Exact text match (optional)" value={questionMatch} onChange={(e) => setQuestionMatch(e.target.value)} />
            <input type="number" min="1" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) || 5)} style={{ width: '70px' }} />
            <button onClick={() => reloadQuestions(0, questionTopicId, questionMatch, pageSize)}>List questions</button>
          </div>
          <div>
            {renderTable(
              ['ID', 'Text', 'Difficulty', ''],
              (questions.content || []).map((question) => [
                question.id,
                question.text,
                question.difficulty,
                <>
                  <button className="g" onClick={() => showResponse(question)}>View</button>
                  <button className="g" onClick={() => showResponse(question)}>Edit</button>
                  <button className="g" onClick={async () => {
                    if (!window.confirm('Delete question ' + question.id + '?')) return;
                    try { const response = await api('DELETE', '/questions/' + question.id); showResponse(response); reloadQuestions(); } catch {}
                  }}>Delete</button>
                </>
              ])
            )}
            <div className="row">
              <button className="g" disabled={pageIndex < 1} onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}>Previous</button>
              <span>Page {pageIndex + 1} of {questions.totalPages || 1}</span>
              <button className="g" disabled={questions.last} onClick={() => setPageIndex((prev) => prev + 1)}>Next</button>
            </div>
          </div>

          <h3>Create question</h3>
          <div className="row">
            <input className="w" placeholder="Question text" value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
            <button onClick={handleCreateQuestion}>Create in selected topic</button>
          </div>

          <h3>Find by ID</h3>
          <div className="row">
            <input type="number" placeholder="Question ID" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
            <button className="g" onClick={async () => { const id = Number(studentId); if (!id) return; showResponse(await api('GET', '/questions/' + id)); }}>Get question</button>
          </div>
        </>
      );
    }

    if (routeName === 'exams') {
      return (
        <>
          <h2>Exams</h2>
          {renderTable(
            ['ID', 'Title', 'Status', 'Minutes', 'Max attempts', ''],
            exams.map((exam) => [
              exam.id,
              exam.title,
              exam.examStatus || exam.status,
              Math.round((exam.durationSeconds || 0) / 60),
              exam.maxAttempts,
              <>
                <a className="b" href={'#exam/' + exam.id}>Open</a>
                <button className="g" onClick={() => handlePublishExam(exam.id)}>Publish</button>
                <button className="g" onClick={() => handleDeleteExam(exam.id)}>Delete</button>
              </>
            ])
          )}

          <h3>Create exam</h3>
          <div className="grid">
            <label>Title<input id="exam-title" /></label>
            <label>Duration (seconds)<input id="exam-duration" type="number" defaultValue={1800} /></label>
            <label>Opens<input id="exam-open" type="datetime-local" defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} /></label>
            <label>Closes<input id="exam-close" type="datetime-local" defaultValue={new Date(Date.now() + 86400000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} /></label>
            <label>Max attempts<input id="exam-attempts" type="number" defaultValue={1} /></label>
            <label>Score per question<input id="exam-score" type="number" defaultValue={1} /></label>
            <label>Penalty per wrong<input id="exam-penalty" type="number" defaultValue={0} /></label>
            <label>Created by<input id="exam-created" defaultValue="teacher-1" /></label>
            <label>
              Status
              <select id="exam-status" defaultValue="DRAFT">
                <option>DRAFT</option>
                <option>PUBLISHED</option>
                <option>CLOSED</option>
              </select>
            </label>
            <label className="ck"><input id="exam-negative" type="checkbox" />Negative marking</label>
          </div>
          <div className="row"><button onClick={handleCreateExam}>Create exam</button></div>
        </>
      );
    }

    if (routeName === 'students') {
      return (
        <>
          <h2>Students</h2>
          <div className="row">
            <input placeholder="Full name" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
            <input placeholder="Email" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} />
            <input type="password" placeholder="Password" value={studentPassword} onChange={(e) => setStudentPassword(e.target.value)} />
            <button onClick={handleCreateStudent}>Create student</button>
          </div>
          <div className="row">
            <input type="number" placeholder="Student ID" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
            <button className="g" onClick={async () => { const id = Number(studentId); if (!id) return; showResponse(await api('GET', '/students/' + id)); }}>Get student</button>
            <button className="g" onClick={handleStudentAttempts}>List attempts</button>
          </div>
          {renderTable(['ID', 'Exam ID', 'Submitted At', 'Score'], (students || []).map((row) => [row.id ?? '', row.examId ?? '', row.submittedAt ?? '', row.score ?? '']))}
        </>
      );
    }

    if (routeName === 'attempts') {
      return (
        <>
          <h2>Attempts</h2>
          <h3>Start an attempt</h3>
          <div className="row">
            <input type="number" placeholder="Exam ID" value={examId} onChange={(e) => setExamId(e.target.value)} />
            <input type="number" placeholder="Student ID" value={examStudentId} onChange={(e) => setExamStudentId(e.target.value)} />
            <button onClick={handleStartAttempt}>Start attempt</button>
          </div>
          <p className="mut">Token {attemptToken} expires {attemptExpiry}</p>
          <div>
            {attemptQuestions.map((question) => (
              <div key={question.id || question.examQuestionId} className="q">
                <b>{question.text}</b>
                {(question.options || []).map((option) => (
                  <label key={option.id} className="row">
                    <input type="radio" name={'q-' + (question.examQuestionId ?? question.id)} checked={answerMap[question.examQuestionId ?? question.id] === option.id} onChange={() => pickAnswer(question.examQuestionId ?? question.id, option.id)} />
                    <span>{option.label}. {option.text}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>

          <h3>Work with an attempt</h3>
          <div className="row">
            <input type="number" placeholder="Attempt ID" value={attemptId} onChange={(e) => setAttemptId(e.target.value)} />
            <button className="g" onClick={async () => { if (!attemptId) return; showResponse(await api('GET', '/attempts/' + attemptId)); }}>Get attempt</button>
            <button className="g" onClick={async () => { if (!attemptId) return; showResponse(await api('GET', '/attempts/' + attemptId + '/result')); }}>Result</button>
          </div>
          <textarea rows={6} value={attemptPayload} onChange={(e) => setAttemptPayload(e.target.value)} />
          <div className="row">
            <button onClick={handleSaveAnswers}>Save answers</button>
            <button onClick={handleSubmitAttempt}>Submit attempt</button>
          </div>
          {resultChips.length > 0 && (
            <div className="row">
              {resultChips.map((chip, index) => <span className="chip" key={index}>{chip}</span>)}
            </div>
          )}
        </>
      );
    }

    return (
      <>
        <h2>Topics</h2>
        <div className="row">
          <input placeholder="Name" value={topicName} onChange={(e) => setTopicName(e.target.value)} />
          <input className="w" placeholder="Description" value={topicDescription} onChange={(e) => setTopicDescription(e.target.value)} />
          <button onClick={handleCreateTopic}>Create topic</button>
        </div>
        {renderTable(['ID', 'Name', 'Description', ''], topics.map((topic) => [
          topic.id,
          topic.name,
          topic.description,
          <>
            <button className="g" onClick={() => handleEditTopic(topic.id, 'name', 'New name')}>Rename</button>
            <button className="g" onClick={() => handleEditTopic(topic.id, 'desc', 'New description')}>Edit description</button>
          </>
        ]))}
      </>
    );
  };

  return (
    <div className="app-shell">
      <header>
        <div className="brand">Quiz Bench</div>
        <input
          aria-label="Server URL"
          value={base}
          onChange={(event) => setBase(String(event.target.value).trim().replace(/\/$/, ''))}
        />
      </header>

      <nav>
        {['topics', 'questions', 'exams', 'students', 'attempts'].map((key) => (
          <a key={key} href={'#' + key} className={routeName === key ? 'on' : ''}>{key[0].toUpperCase() + key.slice(1)}</a>
        ))}
      </nav>

      <main>
        {renderRoute()}
      </main>

      <footer>
        <button className="network-toggle" onClick={() => document.body.classList.toggle('show-log')}>
          Network log <span>({logs[0]?.status || '---'})</span>
        </button>
        <div className={`log-panel ${document.body.classList.contains('show-log') ? 'visible' : ''}`}>
          {logs.length ? logs.map((log, index) => (
            <details key={index} open={index === 0}>
              <summary>
                <b>{log.method}</b> {log.url.replace(base, '')} <i className={log.status >= 200 && log.status < 300 ? 'ok' : 'bad'}>{log.status || 'ERR'}</i> {log.ms}ms
              </summary>
              <pre>{JSON.stringify({ request: log.body, response: log.data }, null, 2)}</pre>
            </details>
          )) : <span className="mut">Requests will appear here.</span>}
        </div>
      </footer>

      <div className={`toast ${toast.message ? 'show' : ''} ${toast.error ? 'error' : ''}`} role="status">
        {toast.message}
      </div>

      <pre id="out" className="output-box">{output}</pre>
    </div>
  );
}

export default App;
