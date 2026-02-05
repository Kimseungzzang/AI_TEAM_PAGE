import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { makeId } from './utils';
import { apiRequest } from './apiClient';

import Sidebar from './components/Sidebar';
import TerminalGrid from './components/TerminalGrid';

const WS_URL = process.env.REACT_APP_PTY_WS_URL || 'ws://localhost:8080/ws/terminal';

function MainApp() {
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [userId, setUserId] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', project: '' });
  const [memberForm, setMemberForm] = useState({ name: '', role: 'LEADER', config: '' });
  const [cliTargets, setCliTargets] = useState({});
  const [wsReadyMap, setWsReadyMap] = useState({});
  const [outputs, setOutputs] = useState({});
  const runtime = useRef(new Map());

  const currentTeam = useMemo(
    () => teams.find((team) => String(team.id) === String(selectedTeamId)),
    [teams, selectedTeamId]
  );
  const currentMembers = useMemo(
    () => (currentTeam && Array.isArray(currentTeam.members) ? currentTeam.members : []),
    [currentTeam]
  );

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

  function connectMember(member) {
    if (!member || runtime.current.has(member.sessionId)) return;

    const ws = new WebSocket(WS_URL);
    const state = {
      role: member.role,
      name: member.name,
      ws,
      term: null,
      fitAddon: null,
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
  }, []);

  const handleTerminalData = useCallback((sessionId, data) => {
    const state = runtime.current.get(sessionId);
    if (!state || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    state.ws.send(JSON.stringify({ type: 'input', data }));
  }, []);

  const handleAttachTerminal = useCallback((sessionId, term, fitAddon) => {
    const state = runtime.current.get(sessionId);
    if (!state) return;
    state.term = term;
    state.fitAddon = fitAddon;
  }, []);

  function openTeamModal() {
    setTeamForm({ name: '', project: '' });
    setShowTeamModal(true);
  }

  function openMemberModal() {
    setMemberForm({ name: '', role: 'LEADER', config: '' });
    setShowMemberModal(true);
  }

  function handleCreateTeam() {
    if (!userId) return;
    const payload = {
      name: teamForm.name.trim(),
      project: teamForm.project.trim() || null,
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
      if (payload.type === 'ready') {
        state.ready = true;
        return;
      }
      if (payload.type === 'ws_ready') {
        setWsReadyMap((prev) => ({ ...prev, [sessionId]: true }));
        return;
      }
      if (payload.type === 'shell_ready') {
        if (!state.initSent) {
          const target = cliTargets[sessionId] || 'claude';
          setTimeout(() => {
            state.ws.send(JSON.stringify({ type: 'input', data: target + '\r' }));
            state.initSent = true;
          }, 300);
        }
        return;
      }
      if (payload.type === 'terminal' && payload.data) {
        if (state.term) {
          state.term.write(payload.data);
        }
        appendOutput(sessionId, stripAnsi(payload.data));
        return;
      }
    }
    if (state.term) {
      state.term.write(chunk);
    }
    appendOutput(sessionId, stripAnsi(chunk));
  }

  function appendOutput(sessionId, text) {
    setOutputs((prev) => ({
      ...prev,
      [sessionId]: (prev[sessionId] || '') + text
    }));
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
        teams={teams}
        selectedTeamId={selectedTeamId}
        setSelectedTeamId={setSelectedTeamId}
        sessions={currentMembers}
        onConnectMember={connectMember}
        onConnectTeam={connectTeam}
        onAddTeam={openTeamModal}
        onAddMember={openMemberModal}
        cliTargets={cliTargets}
        onCliTargetChange={handleCliTargetChange}
        wsReadyMap={wsReadyMap}
      />

      <main className="main">
        <TerminalGrid
          sessions={currentMembers}
          outputs={outputs}
          onData={handleTerminalData}
          onAttach={handleAttachTerminal}
        />
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
              <label className="modal-label">프로젝트</label>
              <input
                className="modal-input"
                value={teamForm.project}
                onChange={(e) => setTeamForm((prev) => ({ ...prev, project: e.target.value }))}
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
