// main.js - 主控台功能路由
document.addEventListener('DOMContentLoaded', () => {
    const btnDocs = document.getElementById('btn-docs');
    if (btnDocs) {
        btnDocs.addEventListener('click', () => {
            window.location.href = 'docs/docs.html';
        });
    }

    const btnTeam = document.getElementById('btn-team');
    if (btnTeam) {
        btnTeam.addEventListener('click', () => {
            window.location.href = 'team/team.html';
        });
    }

    const btnMap = document.getElementById('btn-map');
    if (btnMap) {
        btnMap.addEventListener('click', () => {
            window.location.href = 'map/map.html';
        });
    }

    const btnEncyclopedia = document.getElementById('btn-encyclopedia');
    if (btnEncyclopedia) {
        btnEncyclopedia.addEventListener('click', () => {
            window.location.href = 'encyclopedia/encyclopedia.html';
        });
    }

    document.getElementById('btn-export-host')?.addEventListener('click', () => {
        window.location.href = 'cloud/export-for-host.html';
    });
    document.getElementById('btn-shared-view')?.addEventListener('click', () => {
        window.location.href = 'cloud/static-view.html';
    });
    document.getElementById('btn-shared-pull')?.addEventListener('click', () => {
        window.location.href = 'cloud/static-pull.html';
    });
});