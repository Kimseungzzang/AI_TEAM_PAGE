import React from 'react';

function Sidebar({
  teams,
  selectedTeamId,
  setSelectedTeamId,
  sessions,
  onConnectMember,
  onConnectTeam,
  onAddTeam,
  onAddMember,
  cliTargets,
  onCliTargetChange,
  wsReadyMap
}) {
  return (
    <aside className="sidebar">
      <label className="side-label">Team</label>
      <div className="side-team-row">
        <select
          className="side-select"
          value={selectedTeamId || ''}
          onChange={(e) => setSelectedTeamId(e.target.value)}
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <button type="button" className="side-connect" onClick={onConnectTeam}>
          팀 연결
        </button>
      </div>
      <button type="button" className="side-add" onClick={onAddTeam}>
        팀 추가
      </button>
      <div className="side-list">
        {sessions.map((s) => (
          <div key={s.sessionId} className="side-item">
            <span className="side-role">{s.role}</span>
            <span className="side-name">{s.name}</span>
            {wsReadyMap && wsReadyMap[s.sessionId] && (
              <span className="side-status">웹소켓 연결 완료</span>
            )}
            <select
              className="side-cli-select"
              value={(cliTargets && cliTargets[s.sessionId]) || 'claude'}
              onChange={(e) => onCliTargetChange(s.sessionId, e.target.value)}
            >
              <option value="claude">claude</option>
              <option value="codex">codex</option>
              <option value="gemini">gemini</option>
            </select>
            <button type="button" className="side-connect" onClick={() => onConnectMember(s)}>
              연결
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="side-add" onClick={onAddMember}>
        직원 추가
      </button>
    </aside>
  );
}

export default Sidebar;
