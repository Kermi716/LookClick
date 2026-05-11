const BASE_URL = "https://kermi.pythonanywhere.com/api";
const MEDIA_URL = "https://kermi.pythonanywhere.com";

const DEFAULT_POSTER = "https://kermi.pythonanywhere.com/posters/photo_5193051847181145152_x.jpg";

function getPosterUrl(posterPath) {
    if (!posterPath) return DEFAULT_POSTER;
    if (posterPath.startsWith('http://') || posterPath.startsWith('https://')) {
        return posterPath;
    }
    return `${MEDIA_URL}${posterPath}`;
}

let currentUser = null;
let currentCaptchaId = null;

function getNameClass(role, title, isBanned) {
    if (isBanned) return 'banned-user';
    if (role === 'admin') return 'glow-red';
    
    if (title) {
        if (title.includes('Ветеран')) return 'glow-gold';
        if (title.includes('Токсик')) return 'glow-green';
        if (title.includes('Легенда')) return 'glow-purple';
        if (title.includes('Настоящий фанат')) return 'glow-blue';
    }
    return '';
}

function generateAvatar(username) {
    if (!username) return '';
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px Tahoma';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(username.charAt(0).toUpperCase(), canvas.width / 2, canvas.height / 2 + 5);

    return canvas.toDataURL();
}

function handleHash() {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (!hash) {
        showPage('catalog', null, true);
        return;
    }
    const parts = hash.split('/');
    const page = parts[0];
    const data = parts.length > 1 ? parts.slice(1).join('/') : null;
    showPage(page, data, true);
}

window.addEventListener('hashchange', handleHash);

document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    handleHash();
    setupRatingStars();
    
    document.getElementById('modal-overlay').addEventListener('click', closeModals);

    document.getElementById('profile-avatar').addEventListener('change', function(e) {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('profile-avatar-preview').src = e.target.result;
            }
            reader.readAsDataURL(this.files[0]);
        }
    });
});

function getHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { ...getHeaders() }
    };
    if (body) {
        if (body instanceof FormData) {
            options.body = body;
        } else {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
    }
    
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
        if (response.status === 429) {
            throw new Error('Слишком много запросов. Пожалуйста, подождите немного.');
        }
        throw new Error(data.error || 'API Error');
    }
    return data;
}

async function checkAuth() {
    if (!localStorage.getItem('token')) {
        renderAuthUI();
        return;
    }
    try {
        const user = await apiCall('/me');
        currentUser = user;
        renderAuthUI();
    } catch (e) {
        console.error("Auth failed:", e);
        localStorage.removeItem('token');
        currentUser = null;
        renderAuthUI();
    }
}

function renderAuthUI() {
    const box = document.getElementById('auth-box');
    const commentFormBox = document.getElementById('comment-form-container');
    
    if (currentUser) {
        const avatarSrc = currentUser.avatar ? `${MEDIA_URL}${currentUser.avatar}` : generateAvatar(currentUser.username);
        
        let nameClass = getNameClass(currentUser.role, currentUser.title, currentUser.is_banned);
        
        box.innerHTML = `
            <div class="user-profile-btn clickable-user" onclick="showPage('profile', '${currentUser.username}')">
                <img src="${avatarSrc}" alt="avatar">
                <span class="${nameClass}">${currentUser.username}</span>
            </div>
            ${currentUser.role === 'admin' ? `<button onclick="showPage('admin')" style="background:#9b59b6; margin-right:10px;">Админ-панель</button>` : ''}
            <button onclick="logout()" style="background:#444;">Выйти</button>
        `;
        
        if (currentUser.is_banned) {
            commentFormBox.innerHTML = `<div style="color:#ff3333; padding: 10px;">Вы забанены и не можете оставлять комментарии.</div>`;
        } else {
            commentFormBox.innerHTML = `
                <textarea id="new-comment-text" placeholder="Оставьте свой комментарий..."></textarea>
                <button onclick="addComment()">Отправить</button>
            `;
        }
    } else {
        box.innerHTML = `
            <button onclick="openLogin()">Вход</button>
            <button onclick="openRegister()">Регистрация</button>
        `;
        commentFormBox.innerHTML = `
            <div style="color:#aaa; padding: 10px;">Войдите или зарегистрируйтесь, чтобы оставить комментарий.</div>
        `;
    }
    
    loadComments();
}

function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    checkAuth();
}

function openLogin() {
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById('login-modal').style.display = 'block';
}

function openRegister() {
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById('register-modal').style.display = 'block';
    loadCaptcha();
}

function getTitleHtml(title) {
    if (!title) return '';
    let colorClass = 'title-blue';
    if (title === 'Ветеран' || title === 'Ветеран (Золотой)') colorClass = 'title-gold';
    if (title === 'Токсик' || title === 'Токсик (Зеленый)') colorClass = 'title-green';
    if (title === 'Легенда' || title === 'Легенда (Фиолетовый)') colorClass = 'title-purple';
    if (title === 'Админ' || title === 'Администратор') colorClass = 'title-red';
    return `<span class="title-badge ${colorClass}">${title}</span>`;
}

function showPage(pageId, data = null, fromHash = false) {
    if (!fromHash) {
        let newHash = `#${pageId}`;
        if (data) newHash += `/${data}`;
        if (window.location.hash !== newHash) {
            window.location.hash = newHash;
            return;
        }
    }

    const pages = ['catalog-page', 'film-page', 'profile-page', 'admin-page'];
    pages.forEach(p => {
        const el = document.getElementById(p);
        if (el) el.style.display = 'none';
    });
    
    document.getElementById(pageId + '-page').style.display = 'block';
    window.scrollTo(0, 0);

    if (pageId === 'catalog') {
        loadCatalog();
    } else if (pageId === 'film' && data) {
        loadFilm(data);
    } else if (pageId === 'profile' && data) {
        loadProfile(data);
    } else if (pageId === 'admin') {
        loadAdminPanel();
        showAdminTab('users-tab');
    }
}

function closeModals() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

async function login() {
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;
    try {
        const res = await apiCall('/login', 'POST', {username: u, password: p});
        localStorage.setItem('token', res.token);
        closeModals();
        checkAuth();
    } catch(e) {
        alert(e.message);
    }
}

async function register() {
    const u = document.getElementById('reg-username').value;
    const p = document.getElementById('reg-password').value;
    const ans = document.getElementById('reg-captcha').value;
    try {
        const res = await apiCall('/register', 'POST', {
            username: u, password: p, 
            captcha_id: currentCaptchaId, captcha_answer: ans
        });
        localStorage.setItem('token', res.token);
        closeModals();
        checkAuth();
    } catch(e) {
        alert(e.message);
        loadCaptcha();
    }
}

async function loadCaptcha() {
    try {
        const res = await apiCall('/captcha');
        currentCaptchaId = res.captcha_id;
        if (res.type === 'image') {
            document.getElementById('captcha-img').src = res.image;
            document.getElementById('captcha-img').style.display = 'block';
            document.getElementById('captcha-text').style.display = 'none';
        } else {
            document.getElementById('captcha-text').innerText = res.text;
            document.getElementById('captcha-text').style.display = 'block';
            document.getElementById('captcha-img').style.display = 'none';
        }
    } catch(e) {
        console.error(e);
    }
}

async function saveProfile() {
    const pass = document.getElementById('profile-password').value;
    const file = document.getElementById('profile-avatar').files[0];
    const wallToggle = document.getElementById('pp-wall-toggle').checked;
    
    const formData = new FormData();
    if (pass) formData.append('password', pass);
    if (file) formData.append('avatar', file);
    formData.append('wall_enabled', wallToggle);
    const origin = document.getElementById('profile-origin').value;
    const showOrigin = document.getElementById('pp-origin-toggle').checked;
    formData.append('origin', origin);
    formData.append('show_origin', showOrigin);
    
    try {
        const res = await apiCall('/profile', 'POST', formData);
        alert("Профиль обновлен");
        closeModals();
        checkAuth();
        showPage('profile', currentUser.username);
    } catch(e) {
        alert(e.message);
    }
}

async function toggleWall() {
    
}

function updateStarsDisplay(average) {
    const stars = document.querySelectorAll('.star');
    stars.forEach(s => {
        const val = parseInt(s.getAttribute('data-val'));
        let fill = 0;
        if (average >= val) {
            fill = 100;
        } else if (average > val - 1) {
            fill = (average - (val - 1)) * 100;
        }
        s.style.setProperty('--fill', `${fill}%`);
    });
}

async function loadRating() {
    try {
        const res = await apiCall(`/rating/${currentFilmId}`);
        document.getElementById('rating-average').innerText = res.average;
        document.getElementById('rating-count').innerText = res.count;
        updateStarsDisplay(res.average);
    } catch(e) {}
}

function setupRatingStars() {
    const stars = document.querySelectorAll('.star');
    stars.forEach(s => {
        s.addEventListener('mouseover', () => {
            const val = parseInt(s.getAttribute('data-val'));
            stars.forEach(st => {
                if (parseInt(st.getAttribute('data-val')) <= val) {
                    st.classList.add('hovered');
                } else {
                    st.classList.remove('hovered');
                }
            });
        });

        s.addEventListener('mouseout', () => {
            stars.forEach(st => st.classList.remove('hovered'));
        });

        s.addEventListener('click', async () => {
            if (!currentUser) {
                alert("Войдите, чтобы поставить оценку.");
                return;
            }
            if (currentUser.is_banned) {
                alert("Вы забанены.");
                return;
            }
            const val = parseInt(s.getAttribute('data-val'));
            try {
                const res = await apiCall(`/rating/${currentFilmId}`, 'POST', {score: val});
                
                document.getElementById('rating-average').innerText = res.average;
                document.getElementById('rating-count').innerText = res.count;
                document.getElementById('rating-msg').innerText = "Ваша оценка учтена!";
                
                updateStarsDisplay(res.average);
            } catch(e) {
                alert(e.message);
            }
        });
    });
}

async function loadComments() {
    if (!currentFilmId) return;
    try {
        const comments = await apiCall(`/comments/${currentFilmId}`);
        renderCommentsList(comments);
    } catch(e) {}
}

async function addComment() {
    const text = document.getElementById('new-comment-text').value;
    if (!text.trim()) return;
    try {
        await apiCall('/comments', 'POST', { text, film_id: currentFilmId });
        document.getElementById('new-comment-text').value = '';
        loadComments();
    } catch(e) {
        alert(e.message);
    }
}
function getIcon(name) {
    const icons = {
        like: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`,
        dislike: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2"></path></svg>`,
        reply: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path></svg>`,
        trash: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
        ban: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`,
        unban: `<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    };
    return icons[name] || '';
}

function renderCommentsList(comments) {
    const list = document.getElementById('comments-list');
    list.innerHTML = '';
    
    comments.forEach(c => {
        const isAdmin = currentUser && currentUser.role === 'admin';
        const isOwner = currentUser && currentUser.username === c.username;
        if (c.is_deleted && !isAdmin) return;
        let contentHtml = `<div class="comment-text">${c.text}</div>`;
        if (c.is_deleted) {
            contentHtml = `<div class="comment-text deleted-comment">${c.text} (Удалено)</div>`;
        }
        
        const avatar = c.user_info.avatar ? `${MEDIA_URL}${c.user_info.avatar}` : generateAvatar(c.username);
        
        let nameClass = getNameClass(c.user_info.role, c.user_info.title, c.user_info.is_banned);
        
        let actionsHtml = '';
        if (currentUser && !currentUser.is_banned && !c.is_deleted) {
            actionsHtml += `
                <button class="action-btn" onclick="likeComment('${c.id}')">${getIcon('like')} ${c.likes}</button>
                <button class="action-btn" onclick="dislikeComment('${c.id}')">${getIcon('dislike')} ${c.dislikes}</button>
                <button class="action-btn" onclick="showReplyForm('${c.id}')">${getIcon('reply')} Ответить</button>
            `;
            if (isAdmin) {
                if (!c.user_info.is_banned && c.user_info.role !== 'admin') {
                    actionsHtml += `<button class="action-btn" onclick="banUser('${c.username}')" style="color:#e74c3c;">${getIcon('ban')} Бан</button>`;
                } else if (c.user_info.is_banned) {
                    actionsHtml += `<button class="action-btn" onclick="unbanUser('${c.username}')" style="color:#2ecc71;">${getIcon('unban')} Разбан</button>`;
                }
            }
        } else {
            actionsHtml += `<span>${getIcon('like')} ${c.likes} | ${getIcon('dislike')} ${c.dislikes}</span>`;
        }
        
        if (currentUser && (isAdmin || isOwner) && !c.is_deleted) {
            actionsHtml += `<button class="action-btn" onclick="deleteComment('${c.id}')" style="color:#e74c3c; margin-left: 10px;">${getIcon('trash')} Удалить</button>`;
        }

        let repliesHtml = '';
        if (c.replies && c.replies.length > 0) {
            repliesHtml = `<div class="replies-box">`;
            c.replies.forEach(r => {
                if (r.is_deleted && !isAdmin) return;
                let rContentHtml = `<div class="comment-text">${r.text}</div>`;
                if (r.is_deleted) {
                    if (isAdmin) {
                        rContentHtml = `<div class="comment-text deleted-comment">${r.text} (Удалено пользователем)</div>`;
                    } else {
                        rContentHtml = `<div class="comment-text deleted-comment">Комментарий удален</div>`;
                    }
                }
                
                let rNameClass = getNameClass(r.user_info.role, r.user_info.title, r.user_info.is_banned);
                
                let rDelBtn = '';
                if (currentUser && (isAdmin || currentUser.username === r.username) && !r.is_deleted) {
                    rDelBtn = `<button class="action-btn" onclick="deleteCommentReply('${c.id}', '${r.id}')" style="display:inline-block; margin-left:10px;">${getIcon('trash')}</button>`;
                }

                repliesHtml += `
                    <div class="reply-item comment-wrapper">
                        <div class="comment-content">
                            <div class="comment-header">
                                <strong class="clickable-user ${rNameClass}" onclick="showPage('profile', '${r.username}')">${r.username}</strong>
                                <span>${r.date}</span>
                                ${rDelBtn}
                            </div>
                            ${rContentHtml}
                        </div>
                    </div>
                `;
            });
            repliesHtml += `</div>`;
        }

        const div = document.createElement('div');
        div.className = 'comment-item';
        
        div.innerHTML = `
            <div class="comment-wrapper">
                <img src="${avatar}" class="comment-avatar clickable-user" alt="ava" onclick="showPage('profile', '${c.username}')">
                <div class="comment-content">
                    <div class="comment-header">
                        <strong class="clickable-user ${nameClass}" onclick="showPage('profile', '${c.username}')">${c.username}</strong>
                        <span>${c.date}</span>
                    </div>
                    ${contentHtml}
                    <div class="comment-actions">${actionsHtml}</div>
                </div>
            </div>
            ${repliesHtml}
            <div id="reply-form-${c.id}" style="display: none; margin-top: 10px; margin-left: 55px; gap: 10px;">
                <input type="text" id="reply-input-${c.id}" placeholder="Ваш ответ..." style="flex-grow: 1; padding: 6px; background: #222; border: 1px solid #444; color: #fff; font-family: monospace;">
                <button onclick="submitReply('${c.id}')" style="padding: 6px 15px; background: #444; border: 1px solid #555; color: #fff; cursor: pointer;">Отправить</button>
            </div>
        `;
        list.appendChild(div);
    });
}

async function likeComment(id) {
    try {
        await apiCall(`/comments/${id}/like`, 'POST');
        loadComments();
    } catch(e) {
        alert(e.message);
    }
}

async function dislikeComment(id) {
    try {
        await apiCall(`/comments/${id}/dislike`, 'POST');
        loadComments();
    } catch(e) {
        alert(e.message);
    }
}

async function deleteComment(id) {
    if(!confirm("Удалить комментарий?")) return;
    try {
        await apiCall(`/comments/${id}`, 'DELETE');
        loadComments();
    } catch(e) {
        alert(e.message);
    }
}

async function banUser(username) {
    if(!confirm(`Забанить пользователя ${username}?`)) return;
    try {
        await apiCall('/admin/ban', 'POST', {username});
        loadComments();
    } catch(e) {
        alert(e.message);
    }
}

async function unbanUser(username) {
    try {
        await apiCall('/admin/unban', 'POST', {username});
        loadComments();
    } catch(e) {
        alert(e.message);
    }
}

async function loadAdminPanel() {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
        const users = await apiCall('/admin/users');
        const tbody = document.getElementById('admin-users-list');
        tbody.innerHTML = '';
        users.forEach(u => {
            const isB = u.is_banned;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px;" class="clickable-user" onclick="showPage('profile', '${u.username}')">${u.username} ${getTitleHtml(u.title)}</td>
                <td style="padding: 10px;">${u.role}</td>
                <td style="padding: 10px; color: ${isB ? '#ff3333' : '#33ff33'}">${isB ? 'Забанен' : 'Активен'}</td>
                <td style="padding: 10px;">
                    <button onclick="toggleBan('${u.username}', ${isB})" style="padding:5px; margin-right:5px; background: ${isB ? '#2ecc71' : '#e74c3c'};">${isB ? 'Разбанить' : 'Забанить'}</button>
                    <select id="title-select-${u.username}" style="padding:5px; background:#222; color:#fff; border:1px solid #444;">
                        <option value="">Без звания</option>
                        <option value="Ветеран" ${u.title === 'Ветеран' ? 'selected' : ''}>Ветеран (Золотой)</option>
                        <option value="Токсик" ${u.title === 'Токсик' ? 'selected' : ''}>Токсик (Зеленый)</option>
                        <option value="Легенда" ${u.title === 'Легенда' ? 'selected' : ''}>Легенда (Фиолетовый)</option>
                        <option value="Настоящий фанат" ${u.title === 'Настоящий фанат' ? 'selected' : ''}>Настоящий фанат (Синий)</option>
                    </select>
                    <button onclick="setUserTitle('${u.username}')" style="padding:5px;">Выдать звание</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {
        alert(e.message);
    }
}

async function toggleBan(username, isBanned) {
    try {
        if (isBanned) {
            await apiCall('/admin/unban', 'POST', {username});
        } else {
            await apiCall('/admin/ban', 'POST', {username});
        }
        loadAdminPanel();
    } catch(e) { alert(e.message); }
}

async function setUserTitle(username) {
    const title = document.getElementById(`title-select-${username}`).value;
    try {
        await apiCall(`/admin/users/${username}/title`, 'POST', {title: title || null});
        alert('Звание обновлено!');
        loadAdminPanel();
    } catch(e) { alert(e.message); }
}

async function loadProfile(username) {
    currentProfileUsername = username;
    try {
        const res = await apiCall(`/users/${username}`);
        const p = res.profile;
        
        const profileNameClass = getNameClass(p.role, p.title, p.is_banned);
        document.getElementById('pp-username').className = profileNameClass; 
        document.getElementById('pp-username').innerText = p.username;
        
        document.getElementById('pp-title').innerHTML = getTitleHtml(p.title);
        
        document.getElementById('pp-created').innerText = `Дата регистрации: ${p.created_at || 'Неизвестно'}`;

        const originEl = document.getElementById('pp-origin');
        if (p.origin) {
            originEl.innerHTML = `Известен из: ${p.origin}`;
        } else {
            originEl.innerHTML = '';
        }

        const altsBox = document.getElementById('pp-alts');
        if (p.alts && p.alts.length > 0) {
            altsBox.style.display = 'block';
            altsBox.innerHTML = `<strong>Связанные аккаунты (по IP):</strong> ` + p.alts.map(alt => {
                const isObj = typeof alt === 'object' && alt !== null;
                const uname = isObj ? alt.username : alt;
                const isBanned = isObj ? alt.is_banned : false;
                const style = isBanned ? 'color: #777; text-decoration: line-through;' : 'color: #ff9999; text-decoration: underline;';
                return `<span class="clickable-user" style="${style} cursor: pointer;" onclick="showPage('profile', '${uname}')">${uname}</span>`;
            }).join(', ');
        } else {
            if (altsBox) altsBox.style.display = 'none';
        }

        const banMsgElement = document.getElementById('pp-banned-msg');
        if (banMsgElement) {
            if (p.is_banned) {
                banMsgElement.style.display = 'block'; 
            } else {
                banMsgElement.style.display = 'none';  
            }
        }
        
        const avatarSrc = p.avatar ? `${MEDIA_URL}${p.avatar}` : generateAvatar(p.username);
        document.getElementById('pp-avatar').src = avatarSrc;
        
        const isOwner = currentUser && currentUser.username === p.username;
        const settingsBox = document.getElementById('pp-owner-settings');
        if (isOwner) {
            settingsBox.style.display = 'block';
            document.getElementById('pp-wall-toggle').checked = p.wall_enabled;
            document.getElementById('pp-origin-toggle').checked = p.show_origin !== false;
            document.getElementById('profile-origin').value = p.origin || '';
        } else {
            settingsBox.style.display = 'none';
        }

        const formBox = document.getElementById('wall-form-container');
        if (!currentUser) {
            formBox.innerHTML = '<div style="color:#aaa;">Войдите, чтобы написать на стене.</div>';
        } else if (currentUser.is_banned) {
            formBox.innerHTML = '<div style="color:#ff3333;">Вы забанены.</div>';
        } else if (!p.wall_enabled && !isOwner && currentUser.role !== 'admin') {
            formBox.innerHTML = '<div style="color:#aaa;">Пользователь закрыл свою стену.</div>';
        } else {
            formBox.innerHTML = `
                <textarea id="new-wall-text" placeholder="Напишите что-нибудь на стене..."></textarea>
                <button onclick="addWallPost('${username}')">Отправить</button>
            `;
        }

        renderWallList(res.wall, username, p.wall_enabled);

        const favGrid = document.getElementById('pp-favorites-grid');
        if (favGrid) {
            favGrid.innerHTML = '';
            
            if (allFilms.length === 0) {
                const rawFilms = await apiCall('/films');
                allFilms = rawFilms; 
            }

            const userFavorites = p.favorites || [];

            if (userFavorites.length === 0) {
                favGrid.innerHTML = '<div style="color: #aaa; padding: 10px;">Список пуст.</div>';
            } else {
                const favoriteFilms = allFilms.filter(f => userFavorites.includes(f.id));

                favoriteFilms.forEach(f => {
                    const div = document.createElement('div');
                    div.className = 'film-card';
                    div.onclick = () => showPage('film', f.id);
                    
                    const poster = getPosterUrl(f.poster);
                    div.innerHTML = `
                        <img src="${poster}" alt="${f.title}" onerror="this.onerror=null; this.src=DEFAULT_POSTER;">
                        <div class="film-card-info">
                            <div class="film-card-title">${f.title}</div>
                            <div class="film-card-meta">${f.year || ''} • ${f.genre || ''}</div>
                        </div>
                    `;
                    favGrid.appendChild(div);
                });
            }
        }

    } catch(e) {
        console.error("Profile load error:", e);
        alert("Ошибка при загрузке профиля: " + e.message);
    }
}

async function addWallPost(targetUsername) {
    const text = document.getElementById('new-wall-text').value;
    if (!text.trim()) return;
    try {
        await apiCall(`/walls/${targetUsername}`, 'POST', {text});
        loadProfile(targetUsername);
    } catch(e) { alert(e.message); }
}

async function deleteWallPost(targetUsername, postId) {
    if (!confirm('Удалить эту запись?')) return;
    try {
        await apiCall(`/walls/${targetUsername}/${postId}`, 'DELETE');
        loadProfile(targetUsername);
    } catch(e) { alert(e.message); }
}

async function deleteCommentReply(commentId, replyId) {
    if(!confirm("Удалить ответ?")) return;
    try {
        await apiCall(`/comments/${commentId}/reply/${replyId}`, 'DELETE');
        loadComments();
    } catch(e) { alert(e.message); }
}

async function deleteWallReply(targetUsername, postId, replyId) {
    if(!confirm('Удалить этот ответ?')) return;
    try {
        await apiCall(`/walls/${targetUsername}/${postId}/reply/${replyId}`, 'DELETE');
        loadProfile(targetUsername);
    } catch(e) { alert(e.message); }
}

function showReplyForm(commentId) {
    const form = document.getElementById(`reply-form-${commentId}`);
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
}

async function submitReply(commentId) {
    const text = document.getElementById(`reply-input-${commentId}`).value;
    if (!text.trim()) return;
    try {
        await apiCall(`/comments/${commentId}/reply`, 'POST', {text});
        loadComments();
    } catch(e) { alert(e.message); }
}

function showWallReplyForm(postId) {
    const form = document.getElementById(`wall-reply-form-${postId}`);
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
}

async function submitWallReply(targetUsername, postId) {
    const text = document.getElementById(`wall-reply-input-${postId}`).value;
    if (!text.trim()) return;
    try {
        await apiCall(`/walls/${targetUsername}/${postId}/reply`, 'POST', {text});
        loadProfile(targetUsername);
    } catch(e) { alert(e.message); }
}

function filterAdminUsers() {
    const search = document.getElementById('admin-search').value.toLowerCase();
    const rows = document.querySelectorAll('#admin-users-list tr');
    rows.forEach(row => {
        const username = row.cells[0].innerText.toLowerCase();
        row.style.display = username.includes(search) ? '' : 'none';
    });
}

function renderWallList(wallData, targetUsername, isWallOpen) {
    const list = document.getElementById('wall-list');
    list.innerHTML = '';
    
    wallData.sort((a, b) => b.id - a.id);
    
    wallData.forEach(p => {
        const isAdmin = currentUser && currentUser.role === 'admin'; 
        
        if (p.is_deleted && !isAdmin) return;
        const div = document.createElement('div');
        div.className = 'comment-item';
        
        let contentHtml = `<div class="comment-text">${p.text}</div>`;
        if (p.is_deleted) {
            if (currentUser && currentUser.role === 'admin') {
                contentHtml = `<div class="comment-text deleted-comment">${p.text} (Удалено пользователем)</div>`;
            } else {
                contentHtml = `<div class="comment-text deleted-comment">Запись удалена</div>`;
            }
        }
        
        const avatarSrc = p.user_info.avatar ? `${MEDIA_URL}${p.user_info.avatar}` : generateAvatar(p.author);
        
        let nameClass = getNameClass(p.user_info.role, p.user_info.title, p.user_info.is_banned);
        
        let delBtn = '';
        if (currentUser && (currentUser.username === p.author || currentUser.username === targetUsername || currentUser.role === 'admin') && !p.is_deleted) {
            delBtn = `<button class="action-btn" onclick="deleteWallPost('${targetUsername}', '${p.id}')" style="color:#e74c3c; margin-left: 10px;">${getIcon('trash')} Удалить</button>`;
        }
        
        let replyBtn = '';
        const canReply = isWallOpen || (currentUser && (currentUser.username === targetUsername || currentUser.role === 'admin'));
        if (currentUser && !currentUser.is_banned && !p.is_deleted && canReply) {
             replyBtn = `<button class="action-btn" onclick="showWallReplyForm('${p.id}')">${getIcon('reply')} Ответить</button>`;
        }

        let repliesHtml = '';
        if (p.replies && p.replies.length > 0) {
            repliesHtml = `<div class="replies-box">`;
            p.replies.forEach(r => {
                if (r.is_deleted && !isAdmin) return;
                let rContentHtml = `<div class="comment-text">${r.text}</div>`;
                if (r.is_deleted) {
                    if (currentUser && currentUser.role === 'admin') {
                        rContentHtml = `<div class="comment-text deleted-comment">${r.text} (Удалено пользователем)</div>`;
                    } else {
                        rContentHtml = `<div class="comment-text deleted-comment">Запись удалена</div>`;
                    }
                }
                
                let rNameClass = getNameClass(r.user_info.role, r.user_info.title, r.user_info.is_banned);
                
                let rDelBtn = '';
                if (currentUser && (currentUser.username === r.author || currentUser.username === targetUsername || currentUser.role === 'admin') && !r.is_deleted) {
                    rDelBtn = `<button class="action-btn" onclick="deleteWallReply('${targetUsername}', '${p.id}', '${r.id}')" style="display:inline-block; margin-left:10px;">${getIcon('trash')}</button>`;
                }

                repliesHtml += `
                    <div class="reply-item comment-wrapper">
                        <div class="comment-content">
                            <div class="comment-header">
                                <strong class="clickable-user ${rNameClass}" onclick="showPage('profile', '${r.author}')">${r.author}</strong>
                                <span class="comment-date">${r.date}</span>
                                ${rDelBtn}
                            </div>
                            ${rContentHtml}
                        </div>
                    </div>
                `;
            });
            repliesHtml += `</div>`;
        }

        div.innerHTML = `
            <div class="comment-wrapper">
                <img src="${avatarSrc}" alt="avatar" class="comment-avatar clickable-user" onclick="showPage('profile', '${p.author}')">
                <div class="comment-content">
                    <div class="comment-header">
                        <strong class="clickable-user ${nameClass}" onclick="showPage('profile', '${p.author}')">${p.author}</strong>
                        <span class="comment-date">${p.date}</span>
                    </div>
                    ${contentHtml}
                    <div class="comment-actions">
                        ${replyBtn}
                        ${delBtn}
                    </div>
                </div>
            </div>
            ${repliesHtml}
            <div id="wall-reply-form-${p.id}" style="display: none; margin-top: 10px; margin-left: 55px; gap: 10px;">
                <input type="text" id="wall-reply-input-${p.id}" placeholder="Ответить на запись..." style="flex-grow: 1; padding: 6px; background: #222; border: 1px solid #444; color: #fff; font-family: monospace;">
                <button onclick="submitWallReply('${targetUsername}', '${p.id}')" style="padding: 6px 15px; background: #444; border: 1px solid #555; color: #fff; cursor: pointer;">Отправить</button>
            </div>
        `;
        list.appendChild(div);
    });
}

let allFilms = [];
let currentFilmId = null;

function shuffleArray(array) {
    let shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

async function loadCatalog() {
    try {
        const rawFilms = await apiCall('/films');
        allFilms = shuffleArray(rawFilms); 
        
        const genresSet = new Set();
        allFilms.forEach(f => {
            if (f.genre) {
                f.genre.split(',').forEach(g => genresSet.add(g.trim().toLowerCase()));
            }
        });
        const filterSelect = document.getElementById('category-filter');
        filterSelect.innerHTML = '<option value="">Все жанры</option>';
        genresSet.forEach(g => {
            if (g) {
                const opt = document.createElement('option');
                opt.value = g;
                opt.innerText = g.charAt(0).toUpperCase() + g.slice(1);
                filterSelect.appendChild(opt);
            }
        });

        filterCatalog(); 
    } catch(e) { console.error(e); }
}

function renderCatalog(films) {
    const grid = document.getElementById('films-grid');
    grid.innerHTML = '';
    if (films.length === 0) {
        grid.innerHTML = '<div style="color: #aaa;">Каталог пуст.</div>';
        return;
    }
    films.forEach(f => {
        const div = document.createElement('div');
        div.className = 'film-card';
        div.onclick = () => showPage('film', f.id);
        
        const poster = getPosterUrl(f.poster);
        
        const isSeries = f.genre && f.genre.toLowerCase().includes('сериал');
        const typeText = isSeries ? 'Сериал' : 'Фильм';
        const typeColor = isSeries ? 'rgba(155, 89, 182, 0.9)' : 'rgba(52, 152, 219, 0.9)';
        const displayRating = (f.rating && f.rating > 0) ? f.rating.toFixed(1) : "0.0";

        div.innerHTML = `
            <div class="film-poster-wrapper">
                <img src="${poster}" alt="${f.title}" onerror="this.onerror=null; this.src=DEFAULT_POSTER;">
                <div class="film-badge-type" style="background-color: ${typeColor};">${typeText}</div>
                <div class="film-badge-rating"><span>★</span> ${displayRating}</div>
            </div>
            <div class="film-card-info">
                <div class="film-card-title">${f.title}</div>
                <div class="film-card-meta">${f.year || ''} • ${f.genre || ''}</div>
            </div>
        `;
        grid.appendChild(div);
    });
}

function filterCatalog() {
    const search = document.getElementById('catalog-search').value.toLowerCase();
    const category = document.getElementById('category-filter').value.toLowerCase();
    const sortBy = document.getElementById('sort-filter').value;
    
    let filtered = allFilms.filter(f => {
        const matchesSearch = f.title.toLowerCase().includes(search);
        const matchesCategory = category === "" || (f.genre && f.genre.toLowerCase().includes(category));
        return matchesSearch && matchesCategory;
    });

    if (sortBy === 'newest') {
        filtered.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));
    } else if (sortBy === 'az') {
        filtered.sort((a, b) => a.title.localeCompare(b.title));
    } 
    if (!search) {
        filtered = filtered.slice(0, 20);
    }

    renderCatalog(filtered);
}

async function loadFilm(filmId) {
    currentFilmId = filmId;
    try {
        const film = await apiCall(`/films/${filmId}`);
        document.getElementById('film-title').innerText = film.title;
        const posterImg = document.getElementById('film-poster');
        posterImg.onerror = function() {
            this.onerror = null;
            this.src = DEFAULT_POSTER;
        };
        posterImg.src = getPosterUrl(film.poster);
        document.getElementById('film-year').innerText = film.year || '—';
        document.getElementById('film-country').innerText = film.country || '—';
        document.getElementById('film-genre').innerText = film.genre || '—';
        document.getElementById('film-director').innerText = film.director || '—';
        document.getElementById('film-cast').innerText = film.cast || '—';
        document.getElementById('film-quality').innerText = film.quality || '—';
        document.getElementById('film-description').innerText = film.description || 'Нет описания.';
        
        renderPlayer(film.player_data ||[]);
        
        updateFavoriteButton();
        
        loadRating();
        loadComments();
    } catch(e) {
        alert(e.message);
        showPage('catalog');
    }
}

function renderPlayer(playerData) {
    const container = document.getElementById('player-container');
    container.innerHTML = '';
    
    if (!playerData || playerData.length === 0) {
        container.innerHTML = '<div style="padding: 20px; color: #aaa;">Видео недоступно.</div>';
        return;
    }
    
    const windowDiv = document.createElement('div');
    windowDiv.className = 'player-window';
    windowDiv.id = 'main-player-window';
    
    let activeTranslation = playerData[0];
    let activeSeason = activeTranslation.seasons ? activeTranslation.seasons[0] : null;
    let activeEpisode = activeSeason && activeSeason.episodes ? activeSeason.episodes[0] : null;
    
    const overlayDiv = document.createElement('div');
    overlayDiv.className = 'player-interface-overlay';
    
    const controlsRow = document.createElement('div');
    controlsRow.className = 'player-controls-row';
    
    function updateView() {
        windowDiv.innerHTML = '';
        controlsRow.innerHTML = '';
        
        if (playerData.length > 0) {
            const transWrapper = document.createElement('div');
            transWrapper.className = 'select-wrapper';
            transWrapper.innerHTML = '<span class="select-label">Озвучка:</span>';
            
            const transSelect = document.createElement('select');
            transSelect.className = 'player-select';
            playerData.forEach((t, index) => {
                const opt = document.createElement('option');
                opt.value = index;
                opt.innerText = t.translation;
                if (t === activeTranslation) opt.selected = true;
                transSelect.appendChild(opt);
            });
            
            transSelect.onchange = (e) => {
                activeTranslation = playerData[e.target.value];
                activeSeason = activeTranslation.seasons ? activeTranslation.seasons[0] : null;
                activeEpisode = activeSeason && activeSeason.episodes ? activeSeason.episodes[0] : null;
                updateView();
            };
            
            transWrapper.appendChild(transSelect);
            controlsRow.appendChild(transWrapper);
        }
        
        const videoContainer = document.createElement('div');
        videoContainer.style.width = '100%';
        videoContainer.style.height = '100%';
        videoContainer.style.position = 'absolute';
        videoContainer.style.top = '0';
        videoContainer.style.left = '0';
        videoContainer.style.zIndex = '1';
        
        if (activeTranslation.url && (!activeTranslation.seasons || activeTranslation.seasons.length === 0)) {
            if (playerData.length === 1) {
                overlayDiv.style.display = 'none';
            } else {
                overlayDiv.style.display = 'block';
            }
            
            const iframe = document.createElement('iframe');
            iframe.src = activeTranslation.url;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('referrerpolicy', 'no-referrer'); 
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
            videoContainer.appendChild(iframe);
            
        } else {
            overlayDiv.style.display = 'block';
            
            if (activeTranslation.seasons && activeTranslation.seasons.length > 0) {
                const seasonWrapper = document.createElement('div');
                seasonWrapper.className = 'select-wrapper';
                seasonWrapper.innerHTML = '<span class="select-label">Сезон:</span>';
                
                const seasonSelect = document.createElement('select');
                seasonSelect.className = 'player-select';
                activeTranslation.seasons.forEach((s, index) => {
                    const opt = document.createElement('option');
                    opt.value = index;
                    opt.innerText = s.season;
                    if (s === activeSeason) opt.selected = true;
                    seasonSelect.appendChild(opt);
                });
                
                seasonSelect.onchange = (e) => {
                    activeSeason = activeTranslation.seasons[e.target.value];
                    activeEpisode = activeSeason.episodes ? activeSeason.episodes[0] : null;
                    updateView();
                };
                
                seasonWrapper.appendChild(seasonSelect);
                controlsRow.appendChild(seasonWrapper);
                
                if (activeSeason.episodes && activeSeason.episodes.length > 0) {
                    const epWrapper = document.createElement('div');
                    epWrapper.className = 'select-wrapper';
                    epWrapper.innerHTML = '<span class="select-label">Серия:</span>';
                    
                    const epSelect = document.createElement('select');
                    epSelect.className = 'player-select';
                    activeSeason.episodes.forEach((ep, index) => {
                        const opt = document.createElement('option');
                        opt.value = index;
                        opt.innerText = ep.title;
                        if (ep === activeEpisode) opt.selected = true;
                        epSelect.appendChild(opt);
                    });
                    
                    epSelect.onchange = (e) => {
                        activeEpisode = activeSeason.episodes[e.target.value];
                        updateView();
                    };
                    
                    epWrapper.appendChild(epSelect);
                    controlsRow.appendChild(epWrapper);
                    
                    if (activeEpisode && activeEpisode.url) {
                        const iframe = document.createElement('iframe');
                        iframe.src = activeEpisode.url;
                        iframe.style.width = '100%';
                        iframe.style.height = '100%';
                        iframe.style.border = 'none';
                        iframe.setAttribute('allowfullscreen', 'true');
                        iframe.setAttribute('referrerpolicy', 'no-referrer');
                        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
                        videoContainer.appendChild(iframe);
                    } else {
                        videoContainer.innerHTML = '<div style="display:flex; flex-direction:column; height:100%; justify-content:center; align-items:center;"><div class="play-btn">▶</div><div class="player-text">Видео недоступно</div></div>';
                    }
                }
            }
        }
        
        overlayDiv.innerHTML = '';
        overlayDiv.appendChild(controlsRow);
        
        windowDiv.appendChild(videoContainer);
        windowDiv.appendChild(overlayDiv); 
    }
    
    container.appendChild(windowDiv);
    updateView();
}

function showAdminTab(event, tabId) {
    document.getElementById('admin-users-tab').style.display = 'none';
    document.getElementById('admin-films-tab').style.display = 'none';
    document.getElementById('admin-stats-tab').style.display = 'none';
    
    document.querySelectorAll('.admin-tabs .modal-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    const tabEl = document.getElementById(tabId);
    if (tabEl) tabEl.style.display = 'block';
    
    if (tabId === 'admin-films-tab') {
        loadAdminFilms();
    } else if (tabId === 'admin-stats-tab') { 
        loadAdminStats();
    }
}

async function loadAdminFilms() {
    try {
        const films = await apiCall('/films');
        const list = document.getElementById('admin-films-list');
        list.innerHTML = '';
        films.forEach(f => {
            const tr = document.createElement('tr');
            const poster = getPosterUrl(f.poster);
            tr.innerHTML = `
                <td style="padding: 10px;"><img src="${poster}" style="width: 50px; height: 75px; object-fit: cover;" onerror="this.onerror=null; this.src=DEFAULT_POSTER;"></td>
                <td style="padding: 10px;">${f.title}</td>
                <td style="padding: 10px;">${f.year || ''}</td>
                <td style="padding: 10px;">
                    <button onclick="editAdminFilm('${f.id}')" style="padding:5px; margin-right:5px; background: #3498db; border:none; color:#fff; cursor:pointer;">Редактировать</button>
                    <button onclick="deleteAdminFilm('${f.id}')" style="padding:5px; background: #e74c3c; border:none; color:#fff; cursor:pointer;">Удалить</button>
                </td>
            `;
            list.appendChild(tr);
        });
    } catch(e) { console.error(e); }
}

function filterAdminFilms() {
    const search = document.getElementById('admin-films-search').value.toLowerCase();
    const rows = document.querySelectorAll('#admin-films-list tr');
    rows.forEach(row => {
        if (row.cells && row.cells.length > 1) {
            const title = row.cells[1].innerText.toLowerCase();
            row.style.display = title.includes(search) ? '' : 'none';
        }
    });
}

function clearAdminFilmForm() {
    document.getElementById('admin-film-id').value = '';
    document.getElementById('admin-film-title').value = '';
    document.getElementById('admin-film-desc').value = '';
    document.getElementById('admin-film-year').value = '';
    document.getElementById('admin-film-country').value = '';
    document.getElementById('admin-film-genre').value = '';
    document.getElementById('admin-film-quality').value = '';
    document.getElementById('admin-film-director').value = '';
    document.getElementById('admin-film-cast').value = '';
    document.getElementById('admin-film-poster').value = '';
    document.getElementById('admin-film-player').value = '';
    document.getElementById('admin-film-poster-url').value = '';
}

async function editAdminFilm(filmId) {
    try {
        const film = await apiCall(`/films/${filmId}`);
        document.getElementById('admin-film-id').value = film.id;
        document.getElementById('admin-film-title').value = film.title;
        document.getElementById('admin-film-desc').value = film.description || '';
        document.getElementById('admin-film-year').value = film.year || '';
        document.getElementById('admin-film-country').value = film.country || '';
        document.getElementById('admin-film-genre').value = film.genre || '';
        document.getElementById('admin-film-quality').value = film.quality || '';
        document.getElementById('admin-film-director').value = film.director || '';
        document.getElementById('admin-film-cast').value = film.cast || '';
        
        if (film.player_data) {
            document.getElementById('admin-film-player').value = JSON.stringify(film.player_data, null, 2);
        } else {
            document.getElementById('admin-film-player').value = '[]';
        }
        if (film.poster && film.poster.startsWith('http')) {
            document.getElementById('admin-film-poster-url').value = film.poster;
        } else {
            document.getElementById('admin-film-poster-url').value = '';
        }
        window.scrollTo(0, 0);
    } catch(e) { alert(e.message); }
}

async function saveAdminFilm() {
    const id = document.getElementById('admin-film-id').value;
    const formData = new FormData();
    
    if (id) formData.append('id', id);
    formData.append('title', document.getElementById('admin-film-title').value);
    formData.append('description', document.getElementById('admin-film-desc').value);
    formData.append('year', document.getElementById('admin-film-year').value);
    formData.append('country', document.getElementById('admin-film-country').value);
    formData.append('genre', document.getElementById('admin-film-genre').value);
    formData.append('quality', document.getElementById('admin-film-quality').value);
    formData.append('director', document.getElementById('admin-film-director').value);
    formData.append('cast', document.getElementById('admin-film-cast').value);
    
    const pJson = document.getElementById('admin-film-player').value;
    if (pJson) formData.append('player_json', pJson);
    
    const posterUrl = document.getElementById('admin-film-poster-url').value;
    if (posterUrl) formData.append('poster_url', posterUrl);

    const file = document.getElementById('admin-film-poster').files[0];
    if (file) formData.append('poster', file);
    
    try {
        await apiCall('/admin/films', 'POST', formData);
        alert('Фильм сохранен');
        clearAdminFilmForm();
        loadAdminFilms();
    } catch(e) { alert(e.message); }
}

async function deleteAdminFilm(filmId) {
    if(!confirm("Удалить фильм?")) return;
    try {
        await apiCall(`/admin/films/${filmId}`, 'DELETE');
        loadAdminFilms();
    } catch(e) { alert(e.message); }
}

let trafficChartInstance = null;

async function loadAdminStats() {
    try {
        const stats = await apiCall('/admin/stats');
        
        const todayStr = new Date().toISOString().split('T')[0];
        const todayStats = stats[todayStr] || { views: 0, unique_ips:[], countries: {} };
        
        document.getElementById('stats-online-today').innerText = todayStats.unique_ips.length;
        document.getElementById('stats-views-today').innerText = todayStats.views;
        
        const countriesList = document.getElementById('stats-countries-list');
        countriesList.innerHTML = '';
        
        const sortedCountries = Object.entries(todayStats.countries)
            .sort((a, b) => b[1] - a[1]);
            
        if (sortedCountries.length === 0) {
            countriesList.innerHTML = '<li style="color:#777;">Данных пока нет</li>';
        } else {
            sortedCountries.forEach(([country, count]) => {
                const li = document.createElement('li');
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.marginBottom = '5px';
                li.style.borderBottom = '1px dashed #444';
                li.innerHTML = `<span>${country}</span> <strong style="color:#3498db;">${count} чел.</strong>`;
                countriesList.appendChild(li);
            });
        }
        
        const labels = [];
        const viewsData = [];
        const uniqueData =[];
        
        const sortedDates = Object.keys(stats).sort();
        
        sortedDates.forEach(date => {
            labels.push(date);
            viewsData.push(stats[date].views);
            uniqueData.push(stats[date].unique_ips.length);
        });

        if (trafficChartInstance) {
            trafficChartInstance.destroy();
        }

        const ctx = document.getElementById('trafficChart').getContext('2d');
        
        Chart.defaults.color = '#ccc';
        Chart.defaults.borderColor = '#444';

        trafficChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets:[
                    {
                        label: 'Всего просмотров',
                        data: viewsData,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Уникальные посетители',
                        data: uniqueData,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Динамика посещаемости',
                        color: '#fff',
                        font: { size: 16 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

    } catch (e) {
        console.error("Ошибка загрузки статистики:", e);
    }
}

function handleSearchInput() {
    const search = document.getElementById('catalog-search').value.toLowerCase();
    const suggBox = document.getElementById('search-suggestions');
    
    filterCatalog();

    if (!search) {
        suggBox.style.display = 'none';
        return;
    }

    const matches = allFilms.filter(f => f.title.toLowerCase().includes(search)).slice(0, 5);
    
    if (matches.length === 0) {
        suggBox.style.display = 'none';
    } else {
        suggBox.innerHTML = '';
        matches.forEach(f => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            
            div.innerHTML = `
                <span class="suggestion-title">${f.title}</span> 
                <span class="suggestion-meta">(${f.year || '?'})</span>
            `;
            
            div.onclick = () => {
                document.getElementById('catalog-search').value = '';
                suggBox.style.display = 'none';
                showPage('film', f.id);
            };
            
            suggBox.appendChild(div);
        });
        suggBox.style.display = 'block';
    }
}

document.addEventListener('click', (e) => {
    const searchInput = document.getElementById('catalog-search');
    const suggBox = document.getElementById('search-suggestions');
    if (e.target !== searchInput && e.target !== suggBox) {
        if (suggBox) suggBox.style.display = 'none';
    }
});

async function toggleFavorite() {
    if (!currentUser) {
        alert("Войдите в аккаунт, чтобы добавлять фильмы в избранное!");
        return;
    }
    
    const isFav = currentUser.favorites && currentUser.favorites.includes(currentFilmId);
    
    try {
        if (isFav) {
            const res = await apiCall(`/favorites/${currentFilmId}`, 'DELETE');
            currentUser.favorites = res.favorites;
        } else {
            const res = await apiCall(`/favorites/${currentFilmId}`, 'POST');
            currentUser.favorites = res.favorites;
        }
        updateFavoriteButton();
    } catch(e) {
        alert(e.message);
    }
}

function updateFavoriteButton() {
    const btn = document.getElementById('favorite-btn');
    if (!currentUser) {
        btn.style.display = 'none';
        return;
    }
    
    btn.style.display = 'inline-block';
    const isFav = currentUser.favorites && currentUser.favorites.includes(currentFilmId);
    
    if (isFav) {
        btn.innerHTML = 'Удалить из избранного';
        btn.style.background = '#e74c3c'; 
    } else {
        btn.innerHTML = '❤ В избранное';
        btn.style.background = '#2ecc71';
    }
}

function shareFilmLink() {
    const currentUrl = window.location.href;
    
    navigator.clipboard.writeText(currentUrl).then(() => {
        const btn = document.getElementById('share-btn');
        const originalText = btn.innerHTML;
        const originalBg = btn.style.background;
        
        btn.innerHTML = 'Скопировано!';
        btn.style.background = '#2ecc71';
        
        setTimeout(() => {
            btn.innerHTML = '🔗 Поделиться';
            btn.style.background = '#3498db';
        }, 2000);
    }).catch(err => {
        console.error('Ошибка копирования: ', err);
        alert('Не удалось скопировать ссылку.');
    });
}