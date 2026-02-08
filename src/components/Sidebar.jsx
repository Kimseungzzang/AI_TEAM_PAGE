import React from 'react';

function Sidebar({
  projects,
  onAddProject
}) {
  return (
    <aside className="sidebar">
      <label className="side-label">Projects</label>
      <div className="side-list">
        {projects && projects.length > 0 ? (
          projects.map((project) => (
            <div key={project.id} className="side-project-item">
              <span className="side-project-name">{project.name}</span>
              {project.workSpaceUrl && (
                <span className="side-project-url" title={project.workSpaceUrl}>
                  {project.workSpaceUrl.split('/').pop()}
                </span>
              )}
            </div>
          ))
        ) : (
          <div className="side-empty">프로젝트 없음</div>
        )}
      </div>
      <button type="button" className="side-add" onClick={onAddProject}>
        프로젝트 추가
      </button>
    </aside>
  );
}

export default Sidebar;
