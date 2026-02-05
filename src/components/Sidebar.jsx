import React from 'react';

function Sidebar({ teams, selectedTeamId, setSelectedTeamId, sessions, onConnectMember, onConnectTeam, onAddTeam, onAddMember }) {
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
