import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { makeId } from './utils';
import { apiRequest } from './apiClient';

import Sidebar from './components/Sidebar';

const WS_URL = process.env.REACT_APP_PTY_WS_URL || 'ws://localhost:8080/ws/terminal';
const PERMISSION_OPTIONS = {
  claude: [
    { value: 'default', label: 'Default' },
    { value: 'plan', label: 'Plan Mode' },
    { value: 'auto-edit', label: 'Auto Edit' },
    { value: 'full-auto', label: 'Full Auto' },
    { value: 'bypass-permissions', label: 'Bypass' }
  ],
  codex: [
    { value: 'default', label: 'Default' },
    { value: 'suggest', label: 'Suggest' },
    { value: 'auto-edit', label: 'Auto Edit' },
    { value: 'full-auto', label: 'Full Auto' }
  ],
  gemini: [
    { value: 'default', label: 'Default' },
    { value: 'yolo', label: 'YOLO' }
  ]
};

function MainApp() {
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [userId, setUserId] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '' });
  const [memberForm, setMemberForm] = useState({ name: '', role: 'LEADER', config: '' });
  const [projectForm, setProjectForm] = useState({ name: '' });
  const [cliTargets, setCliTargets] = useState({});
  const [permissionTargets, setPermissionTargets] = useState({});
  const [wsReadyMap, setWsReadyMap] = useState({});
  const [outputLog, setOutputLog] = useState('');
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalTarget, setTerminalTarget] = useState('all');
  const runtime = useRef(new Map());

  const currentTeam = useMemo(
    () => teams.find((team) => String(team.id) === String(selectedTeamId)),
    [teams, selectedTeamId]
  );
  const currentMembers = useMemo(
    () => (currentTeam && Array.isArray(currentTeam.members) ? currentTeam.members : []),
    [currentTeam]
  );
  const [projects, setProjects] = useState([]);

  function loadProjects(teamId) {
    if (!teamId) {
      setProjects([]);
      return;
    }
    apiRequest(`/api/projects?teamId=${teamId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load projects');
        }
        return response.json();
      })
      .then((data) => {
        setProjects(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setProjects([]);
      });
  }

  function loadTeams(nextUserId) {
    apiRequest(`/api/teams?userId=${nextUserId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load teams');
        }
        return response.json();
      })
      .then((data) => {
        const teamList = Array.isArray(data) ? data : [];
        if (!teamList.length) {
          setTeams([]);
          setSelectedTeamId('');
          return;
        }
        const normalized = teamList.map((team) => ({
          ...team,
          members: (Array.isArray(team.members) ? team.members : []).map((member) => ({
            ...member,
            sessionId: member.id ? `m-${member.id}` : makeId(`${member.role}-${member.name}`)
          }))
        }));
        setTeams(normalized);
        setSelectedTeamId((prev) => prev || String(teamList[0].id));
      })
      .catch(() => {
        setTeams([]);
      });
  }

  useEffect(() => {
    const stored = localStorage.getItem('authUser');
    if (!stored) {
      return;
    }

    let user = null;
    try {
      user = JSON.parse(stored);
    } catch (e) {
      return;
    }

    if (!user || !user.id) {
      return;
    }

    setUserId(user.id);
    loadTeams(user.id);
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      loadProjects(selectedTeamId);
    }
  }, [selectedTeamId]);

  function connectMember(member) {
    if (!member || runtime.current.has(member.sessionId)) return;

    const ws = new WebSocket(WS_URL);
    const state = {
      role: member.role,
      name: member.name,
      ws,
      cli: cliTargets[member.sessionId] || 'claude',
      permission: permissionTargets[member.sessionId] || 'default',
      initialized: false,
      ready: false,
      initSent: false
    };
    runtime.current.set(member.sessionId, state);

    ws.onopen = () => {
      if (state.initialized) return;
      state.initialized = true;
    };

    ws.onmessage = (e) => handleChunk(member.sessionId, e.data);
    ws.onerror = () => {
    };
    ws.onclose = () => {
    };
  }

  function connectTeam() {
    currentMembers.forEach((member) => connectMember(member));
  }

  const handleCliTargetChange = useCallback((sessionId, value) => {
    setCliTargets((prev) => ({ ...prev, [sessionId]: value }));
    const state = runtime.current.get(sessionId);
    if (state) {
      state.cli = value;
    }
  }, []);

  const handlePermissionChange = useCallback((sessionId, value) => {
    setPermissionTargets((prev) => ({ ...prev, [sessionId]: value }));
    const state = runtime.current.get(sessionId);
    if (state) {
      state.permission = value;
    }
  }, []);

  function sendToSession(sessionId, payload) {
    const state = runtime.current.get(sessionId);
    if (!state || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    const message = payload && typeof payload === 'object' ? payload : { type: 'input', data: String(payload || '') };
    state.ws.send(JSON.stringify(message));
  }

  function getMemberBySessionId(sessionId) {
    return currentMembers.find((member) => member.sessionId === sessionId) || null;
  }

  function buildCliPayload(cli, configPath, text, permission) {
    const pathValue = configPath || '.';
    const suffix = pathValue.endsWith('.') ? '' : '.';
    const prefix =
      `(Team Settings file path: ${pathValue}${suffix} ` +
      '이 경로에 있는 모든 md 파일을 읽고 답할 수 있도록, members 폴더 내의 md 파일은 본인 이름에 해당하는 md 파일만 읽어주세요. ' +
      '이 괄호 안 내용은 인지만 하고, 답변에는 반영하지 마세요.) ';
    return {
      type: 'input',
      cli,
      data: prefix + text,
      permission: permission || 'default'
    };
  }

  function resolvePermission(cli, sessionId) {
    const state = runtime.current.get(sessionId);
    const raw = state?.permission || permissionTargets[sessionId] || 'default';
    if (raw && raw !== 'default') return raw;
    if (cli === 'claude') return 'bypass-permissions';
    if (cli === 'codex') return 'full-auto';
    if (cli === 'gemini') return 'yolo';
    return 'default';
  }

  function getConfigPathFromTeam(team) {
    if (!team || !team.config) return '';
    const lines = String(team.config)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return lines.length ? lines[lines.length - 1] : '';
  }

  function handleTerminalSend() {
    const text = terminalInput.replace(/\r?\n+/g, ' ');
    if (!text.trim()) return;
    appendLocal(text);
    if (terminalTarget === 'all') {
      currentMembers.forEach((member) => {
        const state = runtime.current.get(member.sessionId);
        const cli = state?.cli || 'claude';
        const permission = resolvePermission(cli, member.sessionId);
        const configPath = getConfigPathFromTeam(currentTeam);
        sendToSession(member.sessionId, buildCliPayload(cli, configPath, text, permission));
      });
    } else {
      const member = getMemberBySessionId(terminalTarget);
      const state = runtime.current.get(terminalTarget);
      const cli = state?.cli || 'claude';
      const permission = resolvePermission(cli, terminalTarget);
      const configPath = getConfigPathFromTeam(currentTeam);
      sendToSession(terminalTarget, buildCliPayload(cli, configPath, text, permission));
    }
    setTerminalInput('');
  }

  function openTeamModal() {
    setTeamForm({ name: '' });
    setShowTeamModal(true);
  }

  function openMemberModal() {
    setMemberForm({ name: '', role: 'LEADER', config: '' });
    setShowMemberModal(true);
  }

  function handleDeleteMember() {
    if (!terminalTarget || terminalTarget === 'all') {
      alert('삭제할 직원을 선택하세요.');
      return;
    }
    const member = getMemberBySessionId(terminalTarget);
    if (!member || !member.id) {
      alert('삭제할 직원 정보를 찾을 수 없습니다.');
      return;
    }
    if (!window.confirm(`${member.name} 직원을 삭제할까요?`)) return;

    apiRequest(`/api/members/${member.id}`, { method: 'DELETE' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to delete member');
        }
        const state = runtime.current.get(member.sessionId);
        if (state?.ws) {
          state.ws.close();
        }
        runtime.current.delete(member.sessionId);
        setWsReadyMap((prev) => {
          const next = { ...prev };
          delete next[member.sessionId];
          return next;
        });
        setCliTargets((prev) => {
          const next = { ...prev };
          delete next[member.sessionId];
          return next;
        });
        setPermissionTargets((prev) => {
          const next = { ...prev };
          delete next[member.sessionId];
          return next;
        });
        if (userId) {
          loadTeams(userId);
        }
        setTerminalTarget('all');
      })
      .catch(() => {
        alert('직원 삭제에 실패했습니다.');
      });
  }

  function openProjectModal() {
    setProjectForm({ name: '' });
    setShowProjectModal(true);
  }

  function handleCreateTeam() {
    if (!userId) return;
    const payload = {
      name: teamForm.name.trim(),
      userId
    };
    apiRequest('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to create team');
        }
        return response.json();
      })
      .then(() => {
        setShowTeamModal(false);
        loadTeams(userId);
      })
      .catch(() => {
      });
  }

  function handleCreateMember() {
    if (!selectedTeamId) return;
    const payload = {
      name: memberForm.name.trim(),
      role: memberForm.role,
      config: memberForm.config.trim() || null,
      teamId: Number(selectedTeamId)
    };
    apiRequest('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to create member');
        }
        return response.json();
      })
      .then(() => {
        setShowMemberModal(false);
        loadTeams(userId);
      })
      .catch(() => {
      });
  }

  function handleCreateProject() {
    if (!selectedTeamId) return;
    const payload = {
      name: projectForm.name.trim(),
      teamId: Number(selectedTeamId)
    };
    apiRequest('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to create project');
        }
        return response.json();
      })
      .then(() => {
        setShowProjectModal(false);
        loadProjects(selectedTeamId);
      })
      .catch(() => {
      });
  }

  function handleChunk(sessionId, chunk) {
    const state = runtime.current.get(sessionId);
    if (!state) return;

    let payload = null;
    try {
      payload = JSON.parse(chunk);
    } catch (e) {
      payload = null;
    }

    console.log(`${state.name}`, chunk);

    if (payload && typeof payload === 'object') {
      if (payload.type === 'ws_ready') {
        setWsReadyMap((prev) => ({ ...prev, [sessionId]: true }));
        if (!state.initSent) {
          const member = getMemberBySessionId(sessionId);
          const configPath = getConfigPathFromTeam(currentTeam);
          const memberName = member?.name ? String(member.name) : '';
          const cli = state?.cli || 'claude';
          const permission = resolvePermission(cli, sessionId);
          const msg = '오늘 회의를 다시 시작할게요~!';
          sendToSession(sessionId, buildCliPayload(cli, configPath, msg, permission));
          state.initSent = true;
        }
        return;
      }
      if (payload.type === 'shell_ready') {
        if (!state.initSent) {
          state.initSent = true;
        }
        return;
      }
      if (payload.type === 'terminal' && payload.data) {
        appendOutput(sessionId, stripAnsi(payload.data));
        return;
      }
    }
    appendOutput(sessionId, stripAnsi(chunk));
  }

  function appendOutput(sessionId, text) {
    const state = runtime.current.get(sessionId);
    const name = state?.name || sessionId;
    const header = `[${name}]\n`;
    const block = `${header}${text || ''}`;
    const normalized = block.endsWith('\n') ? block : block + '\n';
    setOutputLog((prev) => prev + normalized);
  }

  function appendLocal(text) {
    const prefix = '[나] ';
    const lines = (text || '').split('\n');
    const stamped = lines.map((line, idx) => (idx === lines.length - 1 && line === '' ? '' : `${prefix}${line}`));
    const block = stamped.join('\n');
    setOutputLog((prev) => prev + block + (block.endsWith('\n') ? '' : '\n'));
  }

  function stripAnsi(text) {
    if (!text) return '';
    return text
      .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
      .replace(/\u001b\][^\u0007]*\u0007/g, '')
      .replace(/\u001b\][^\u001b]*\u001b\\/g, '')
      .replace(/\u000f|\u000e/g, '');
  }

  return (
    <div className="layout">
      <Sidebar
        projects={projects}
        onAddProject={openProjectModal}
      />

      <main className="main">
        <div className="topbar">
          <div className="team-panel">
            <div className="topbar-label">Team</div>
            <select
              className="topbar-select"
              value={selectedTeamId || ''}
              onChange={(e) => setSelectedTeamId(e.target.value)}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <div className="team-actions">
              <button type="button" className="topbar-button" onClick={connectTeam}>
                팀 연결
              </button>
              <button type="button" className="topbar-button" onClick={openTeamModal}>
                팀 추가
              </button>
            </div>
          </div>

          <div className="member-strip">
            <div className="member-strip-header">
              <div className="topbar-label">Members</div>
              <div className="member-strip-actions">
                <button type="button" className="topbar-button" onClick={openMemberModal}>
                  직원 추가
                </button>
                <button type="button" className="topbar-button danger" onClick={handleDeleteMember}>
                  직원 삭제
                </button>
              </div>
            </div>
            <div className="member-strip-row">
              {currentMembers.map((member) => (
                <div key={member.sessionId} className="member-chip">
                  <div className="member-name-row">
                    <div className="member-name">{member.name}</div>
                    <span
                      className={`member-status ${wsReadyMap[member.sessionId] ? 'is-ready' : 'is-connecting'}`}
                    >
                      {wsReadyMap[member.sessionId] ? '참석' : '미참석'}
                    </span>
                  </div>
                  <div className="member-controls">
                    <select
                      className="member-select"
                      value={(cliTargets && cliTargets[member.sessionId]) || 'claude'}
                      onChange={(e) => handleCliTargetChange(member.sessionId, e.target.value)}
                    >
                      <option value="claude">claude</option>
                      <option value="codex">codex</option>
                      <option value="gemini">gemini</option>
                    </select>
                    <select
                      className="member-select"
                      value={(permissionTargets && permissionTargets[member.sessionId]) || 'default'}
                      onChange={(e) => handlePermissionChange(member.sessionId, e.target.value)}
                    >
                      {(PERMISSION_OPTIONS[(cliTargets && cliTargets[member.sessionId]) || 'claude'] || PERMISSION_OPTIONS.claude).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="member-button" onClick={() => connectMember(member)}>
                      연결
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="terminal-wrap">
          <div className="terminal-controls">
            <select
              className="terminal-select"
              value={terminalTarget}
              onChange={(e) => setTerminalTarget(e.target.value)}
            >
              <option value="all">전체</option>
              {currentMembers.map((member) => (
                <option key={member.sessionId} value={member.sessionId}>
                  {member.name}
                </option>
              ))}
            </select>
            <input
              className="terminal-input"
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.isComposing || e.nativeEvent?.isComposing) return;
                e.preventDefault();
                handleTerminalSend();
              }
            }}
              placeholder="명령 입력..."
            />
            <button type="button" className="terminal-send" onClick={handleTerminalSend}>
              전송
            </button>
          </div>
          <textarea className="terminal-text terminal-merged" value={outputLog} readOnly />
        </div>
      </main>

      {showTeamModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">팀 추가</div>
              <button type="button" className="modal-close" onClick={() => setShowTeamModal(false)}>
                X
              </button>
            </div>
            <div className="modal-body">
              <label className="modal-label">팀 이름</label>
              <input
                className="modal-input"
                value={teamForm.name}
                onChange={(e) => setTeamForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="modal-submit" onClick={handleCreateTeam}>
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {showProjectModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">프로젝트 추가</div>
              <button type="button" className="modal-close" onClick={() => setShowProjectModal(false)}>
                X
              </button>
            </div>
            <div className="modal-body">
              <label className="modal-label">프로젝트 이름</label>
              <input
                className="modal-input"
                value={projectForm.name}
                onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="modal-submit" onClick={handleCreateProject}>
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {showMemberModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">직원 추가</div>
              <button type="button" className="modal-close" onClick={() => setShowMemberModal(false)}>
                X
              </button>
            </div>
            <div className="modal-body">
              <label className="modal-label">이름</label>
              <input
                className="modal-input"
                value={memberForm.name}
                onChange={(e) => setMemberForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <label className="modal-label">역할</label>
              <select
                className="modal-input"
                value={memberForm.role}
                onChange={(e) => setMemberForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="LEADER">LEADER</option>
                <option value="PLANNER">PLANNER</option>
                <option value="FRONTEND_ENGINEER">FRONTEND_ENGINEER</option>
                <option value="BACKEND_ENGINEER">BACKEND_ENGINEER</option>
                <option value="DESIGNER">DESIGNER</option>
              </select>
              <label className="modal-label">설정</label>
              <textarea
                className="modal-textarea"
                value={memberForm.config}
                onChange={(e) => setMemberForm((prev) => ({ ...prev, config: e.target.value }))}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="modal-submit" onClick={handleCreateMember}>
                완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainApp;
