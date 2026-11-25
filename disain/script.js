const SUPABASE_URL = 'https://xqzkpqjihzvcmngkrpzc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxemtwcWppaHp2Y21uZ2tycHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2MjMzMjEsImV4cCI6MjExMTE5OTMyMX0.uH7wyh-yElvHgH5uNiMziTHPaYCC8SmxzXuU1mHSpU8';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;
let currentChat = null;
let messagesSubscription = null;
let isAppInitialized = false;

// === ЭЛЕМЕНТЫ ===
const authScreen = document.getElementById('authScreen');
const app = document.getElementById('app');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const nameField = document.getElementById('nameField');
const authBtn = document.getElementById('authBtn');
const switchText = document.getElementById('switchText');
const switchLink = document.getElementById('switchLink');

const burgerBtn = document.getElementById('burgerBtn');
const leftPanel = document.getElementById('leftPanel');
const userIconBtn = document.getElementById('userIconBtn');
const rightPanel = document.getElementById('rightPanel');
const backdrop = document.getElementById('backdrop');

// === ПАНЕЛИ ===
function openPanel(panel) {
    leftPanel.classList.remove('open');
    rightPanel.classList.remove('open');
    panel.classList.add('open');
    backdrop.classList.add('show');
}

function closePanels() {
    leftPanel.classList.remove('open');
    rightPanel.classList.remove('open');
    backdrop.classList.remove('show');
}

burgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (leftPanel.classList.contains('open')) closePanels();
    else openPanel(leftPanel);
});

userIconBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (rightPanel.classList.contains('open')) closePanels();
    else openPanel(rightPanel);
});

backdrop.addEventListener('click', closePanels);

document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
    });
});

// === ПЕРЕКЛЮЧЕНИЕ ВХОД/РЕГИСТРАЦИЯ ===
switchLink.addEventListener('click', (e) => {
    e.preventDefault();
    const isLogin = authTitle.textContent === 'Вход в Digle';
    if (isLogin) {
        authTitle.textContent = 'Создать аккаунт';
        nameField.style.display = 'block';
        authBtn.textContent = 'Зарегистрироваться';
        switchText.textContent = 'Уже есть аккаунт?';
        switchLink.textContent = 'Войти';
    } else {
        authTitle.textContent = 'Вход в Digle';
        nameField.style.display = 'none';
        authBtn.textContent = 'Войти';
        switchText.textContent = 'Нет аккаунта?';
        switchLink.textContent = 'Зарегистрироваться';
    }
});

// === АВТОРИЗАЦИЯ ===
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const username = document.getElementById('regUsername').value.trim();
    const isLogin = authTitle.textContent === 'Вход в Digle';

    console.log('=== АВТОРИЗАЦИЯ ===', { email, isLogin, username });

    authBtn.disabled = true;
    const oldText = authBtn.textContent;
    authBtn.textContent = 'Загрузка...';

    try {
        if (isLogin) {
            const { data, error } = await db.auth.signInWithPassword({ email, password });
            if (error) throw error;
            currentUser = data.user;
        } else {
            if (!username) {
                alert('Введите имя пользователя');
                authBtn.disabled = false;
                authBtn.textContent = oldText;
                return;
            }
            const { data, error } = await db.auth.signUp({
                email, password,
                options: { data: { username } }
            });
            if (error) throw error;
            currentUser = data.user;

            const { data: profile, error: profileError } = await db
                .from('profiles')
                .insert({ id: currentUser.id, username, role: 'user' })
                .select()
                .single();

            if (profileError) {
                console.error('Ошибка создания профиля:', profileError);
                throw profileError;
            }
            console.log('Профиль создан:', profile);
        }

        // Ставим флаг, чтобы onAuthStateChange не вызвал loadProfile повторно
        isAppInitialized = true;

        authScreen.style.display = 'none';
        app.style.display = 'flex';
        await loadProfile();
        await loadUsers();
    } catch (err) {
        console.error('ОШИБКА АВТОРИЗАЦИИ:', err);
        alert('Ошибка: ' + err.message);
        authBtn.disabled = false;
        authBtn.textContent = oldText;
    }
});

// === ЗАГРУЗКА ПРОФИЛЯ (с проверками на null) ===
async function loadProfile() {
    console.log('Загружаем профиль для:', currentUser.id);

    let { data: profile, error } = await db
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (!profile) {
        console.log('Профиль не найден, создаём...');
        const username = currentUser.user_metadata?.username || 'User' + Math.floor(Math.random() * 1000);

        const { data: newProfile, error: createError } = await db
            .from('profiles')
            .insert({ id: currentUser.id, username, role: 'user' })
            .select()
            .single();

        if (createError) {
            console.error('Не удалось создать профиль:', createError);
            return;
        }
        profile = newProfile;
    }

    currentProfile = profile;

    const displayName = profile?.username || 'Без имени';
    const displayId = profile?.display_id || 0;

    // Безопасная установка с проверками на null
    const profileNameEl = document.getElementById('profileName');
    const editUsernameEl = document.getElementById('editUsername');
    const avatarLetterEl = document.getElementById('avatarLetter');
    const profileIdEl = document.getElementById('profileId');

    if (profileNameEl) profileNameEl.textContent = displayName;
    if (editUsernameEl) editUsernameEl.value = displayName;
    if (profileIdEl) profileIdEl.textContent = '#' + displayId;

    // avatarLetter может быть удалён, если уже загружена аватарка
    if (avatarLetterEl) {
        avatarLetterEl.textContent = displayName[0].toUpperCase();
    }

    userIconBtn.textContent = displayName[0].toUpperCase();

    if (profile?.avatar_url) {
        const avatarHtml = `<img src="${profile.avatar_url}" alt="">`;
        const profileAvatarEl = document.getElementById('profileAvatar');
        if (profileAvatarEl) profileAvatarEl.innerHTML = avatarHtml;
        userIconBtn.innerHTML = avatarHtml;
    }
}

// === ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ ===
async function loadUsers() {
    const { data: users, error } = await db
        .from('profiles')
        .select('id, username, avatar_url, display_id')
        .neq('id', currentUser.id)
        .limit(50);

    if (error) {
        console.error('Ошибка загрузки пользователей:', error);
        return;
    }

    const usersBar = document.getElementById('usersBar');
    usersBar.innerHTML = '';

    if (!users || users.length === 0) {
        usersBar.innerHTML = '<div style="color: #555; font-size: 11px; text-align: center; padding: 10px;">Нет</div>';
        return;
    }

    users.forEach(u => {
        const avatar = document.createElement('div');
        avatar.className = 'user-avatar-small';
        avatar.title = u.username + ' (#' + u.display_id + ')';
        avatar.innerHTML = u.avatar_url
            ? `<img src="${u.avatar_url}" alt="">`
            : (u.username || '?')[0].toUpperCase();
        avatar.addEventListener('click', (ev) => openChatWith(u, ev.currentTarget));
        usersBar.appendChild(avatar);
    });
}

// === ОТКРЫТЬ ЧАТ ===
async function openChatWith(otherUser, avatarEl) {
    document.querySelectorAll('.user-avatar-small').forEach(a => a.classList.remove('active'));
    if (avatarEl) avatarEl.classList.add('active');

    const { data: myMemberships } = await db
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', currentUser.id);

    let chatId = null;

    if (myMemberships) {
        for (const m of myMemberships) {
            const { data: members } = await db
                .from('conversation_members')
                .select('user_id')
                .eq('conversation_id', m.conversation_id);

            if (members && members.length === 2 &&
                members.some(x => x.user_id === otherUser.id)) {
                chatId = m.conversation_id;
                break;
            }
        }
    }

    if (!chatId) {
        const { data: newChat, error: chatError } = await db
            .from('conversations')
            .insert({ is_group: false, title: otherUser.username })
            .select()
            .single();

        if (chatError) {
            alert('Ошибка создания чата: ' + chatError.message);
            return;
        }

        await db.from('conversation_members').insert([
            { conversation_id: newChat.id, user_id: currentUser.id },
            { conversation_id: newChat.id, user_id: otherUser.id }
        ]);

        chatId = newChat.id;
    }

    currentChat = { id: chatId, title: otherUser.username, otherUserId: otherUser.id };
    document.getElementById('chatHeader').textContent = otherUser.username + ' (#' + otherUser.display_id + ')';
    document.getElementById('inputArea').style.display = 'flex';

    await loadMessages();
    subscribeToMessages();
    closePanels();
}

// === СООБЩЕНИЯ ===
async function loadMessages() {
    if (!currentChat) return;

    const { data: messages, error } = await db
        .from('messages')
        .select('*')
        .eq('conversation_id', currentChat.id)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Ошибка загрузки сообщений:', error);
        return;
    }

    const container = document.getElementById('chatMessages');
    container.innerHTML = '';

    if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="empty-chat">Напишите первое сообщение!</div>';
        return;
    }

    messages.forEach(msg => renderMessage(msg));
    container.scrollTop = container.scrollHeight;
}

function renderMessage(msg) {
    const container = document.getElementById('chatMessages');
    const isOwn = msg.sender_id === currentUser.id;

    const div = document.createElement('div');
    div.className = 'message ' + (isOwn ? 'own' : 'other');

    let content = '';
    if (msg.attachment_url) {
        if (msg.attachment_type === 'image') {
            content += `<img class="message-image" src="${msg.attachment_url}" onclick="window.open(this.src)">`;
        } else {
            content += `<a href="${msg.attachment_url}" target="_blank" style="color: inherit;">📎 Файл</a><br>`;
        }
    }
    if (msg.body) content += msg.body;
    content += `<div class="message-meta">${new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>`;

    div.innerHTML = content;
    container.appendChild(div);
}

function subscribeToMessages() {
    if (messagesSubscription) {
        db.removeChannel(messagesSubscription);
    }

    messagesSubscription = db
        .channel('messages-' + currentChat.id)
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + currentChat.id },
            (payload) => {
                renderMessage(payload.new);
                const container = document.getElementById('chatMessages');
                container.scrollTop = container.scrollHeight;
            }
        )
        .subscribe();
}

async function sendMessage(body, attachmentType, attachmentUrl) {
    if (!currentChat) return;

    const { error } = await db.from('messages').insert({
        conversation_id: currentChat.id,
        sender_id: currentUser.id,
        body: body || null,
        attachment_type: attachmentType || null,
        attachment_url: attachmentUrl || null
    });

    if (error) {
        console.error('Ошибка отправки:', error);
        alert('Ошибка отправки: ' + error.message);
    }
}

document.getElementById('sendBtn').addEventListener('click', () => {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;
    sendMessage(text, null, null);
    input.value = '';
});

document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        if (!text) return;
        sendMessage(text, null, null);
        input.value = '';
    }
});

// === ФАЙЛЫ ===
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert('Файл слишком большой (макс. 5 МБ)');
        return;
    }

    attachBtn.disabled = true;
    attachBtn.textContent = '⏳';

    const ext = file.name.split('.').pop();
    const fileName = currentUser.id + '/' + Date.now() + '.' + ext;
    const isImage = file.type.startsWith('image/');

    const { error: uploadError } = await db.storage
        .from('attachments')
        .upload(fileName, file);

    if (uploadError) {
        console.error('Ошибка загрузки файла:', uploadError);
        alert('Ошибка загрузки: ' + uploadError.message);
        attachBtn.disabled = false;
        attachBtn.textContent = '📎';
        return;
    }

    const { data: { publicUrl } } = db.storage
        .from('attachments')
        .getPublicUrl(fileName);

    await sendMessage(null, isImage ? 'image' : 'file', publicUrl);

    attachBtn.disabled = false;
    attachBtn.textContent = '📎';
    fileInput.value = '';
});

// === ПОИСК ===
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    if (query.length < 1) {
        searchResults.innerHTML = '<div style="padding: 16px; color: #666; text-align: center; font-size: 12px;">Начните вводить</div>';
        return;
    }

    let users = [];
    let error = null;

    if (/^\d+$/.test(query)) {
        const num = parseInt(query);
        const result = await db
            .from('profiles')
            .select('id, username, avatar_url, display_id')
            .eq('display_id', num)
            .neq('id', currentUser.id);
        users = result.data || [];
        error = result.error;
    } else {
        const result = await db
            .from('profiles')
            .select('id, username, avatar_url, display_id')
            .ilike('username', '%' + query + '%')
            .neq('id', currentUser.id)
            .limit(10);
        users = result.data || [];
        error = result.error;
    }

    if (error) {
        searchResults.innerHTML = '<div style="padding: 16px; color: #ef4444; text-align: center; font-size: 12px;">Ошибка</div>';
        return;
    }

    if (!users || users.length === 0) {
        searchResults.innerHTML = '<div style="padding: 16px; color: #666; text-align: center; font-size: 12px;">Никого не найдено</div>';
        return;
    }

    searchResults.innerHTML = users.map(u => `
        <div class="search-result-item" data-id="${u.id}" data-name="${u.username}" data-display="${u.display_id}">
            <div class="search-result-avatar">
                ${u.avatar_url ? `<img src="${u.avatar_url}" alt="">` : (u.username || '?')[0].toUpperCase()}
            </div>
            <div class="search-result-info">
                <div class="search-result-name">${u.username}</div>
                <div class="search-result-id">#${u.display_id}</div>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.search-result-item').forEach(el => {
        el.addEventListener('click', async () => {
            const otherUser = {
                id: el.dataset.id,
                username: el.dataset.name,
                display_id: parseInt(el.dataset.display)
            };
            const avatar = document.createElement('div');
            avatar.className = 'user-avatar-small active';
            avatar.title = otherUser.username + ' (#' + otherUser.display_id + ')';
            avatar.innerHTML = otherUser.username[0].toUpperCase();
            avatar.addEventListener('click', (ev) => openChatWith(otherUser, ev.currentTarget));
            document.getElementById('usersBar').prepend(avatar);
            await openChatWith(otherUser, avatar);
        });
    });
});

// === АВАТАРКА ===
const profileAvatar = document.getElementById('profileAvatar');
const avatarInput = document.getElementById('avatarInput');

profileAvatar.addEventListener('click', () => avatarInput.click());

avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        alert('Файл слишком большой (макс. 2 МБ)');
        return;
    }

    const fileName = currentUser.id + '/' + Date.now() + '.' + file.name.split('.').pop();
    const { error } = await db.storage.from('avatars').upload(fileName, file, { upsert: true });

    if (error) {
        console.error('Ошибка загрузки:', error);
        alert('Ошибка загрузки: ' + error.message);
        return;
    }

    const { data: { publicUrl } } = db.storage.from('avatars').getPublicUrl(fileName);

    const { error: updateError } = await db
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', currentUser.id);

    if (updateError) {
        console.error('Ошибка сохранения аватарки:', updateError);
        alert('Аватар загружен, но не сохранился: ' + updateError.message);
        return;
    }

    const avatarHtml = `<img src="${publicUrl}" alt="">`;
    profileAvatar.innerHTML = avatarHtml;
    userIconBtn.innerHTML = avatarHtml;
    if (currentProfile) currentProfile.avatar_url = publicUrl;
    showToast('Аватар сохранён!');
});

// === СОХРАНЕНИЕ ИМЕНИ ===
document.getElementById('saveUsernameBtn').addEventListener('click', async () => {
    const newName = document.getElementById('editUsername').value.trim();
    if (!newName) { alert('Введите имя'); return; }

    const btn = document.getElementById('saveUsernameBtn');
    btn.disabled = true;
    btn.textContent = '...';

    const { error } = await db.from('profiles').update({ username: newName }).eq('id', currentUser.id);

    if (error) {
        console.error('Ошибка сохранения имени:', error);
        alert('Ошибка: ' + error.message);
    } else {
        document.getElementById('profileName').textContent = newName;
        const avatarLetterEl = document.getElementById('avatarLetter');
        if (avatarLetterEl) avatarLetterEl.textContent = newName[0].toUpperCase();
        userIconBtn.textContent = newName[0].toUpperCase();
        showToast('Имя изменено!');
    }

    btn.disabled = false;
    btn.textContent = 'Сохранить';
});

// === КОПИРОВАНИЕ ID ===
document.getElementById('profileId').addEventListener('click', () => {
    const id = currentProfile?.display_id || 0;
    navigator.clipboard.writeText('#' + id);
    showToast('ID скопирован: #' + id);
});

// === ВЫХОД ===
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await db.auth.signOut();
    location.reload();
});

// === УВЕДОМЛЕНИЯ ===
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// === ПРОВЕРКА ПРИ ЗАГРУЗКЕ ===
db.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event, session?.user?.email);

    if (isAppInitialized) return;

    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        isAppInitialized = true;
        currentUser = session.user;
        authScreen.style.display = 'none';
        app.style.display = 'flex';

        userIconBtn.textContent = '?';
        const profileNameEl = document.getElementById('profileName');
        const profileIdEl = document.getElementById('profileId');
        if (profileNameEl) profileNameEl.textContent = 'Загрузка...';
        if (profileIdEl) profileIdEl.textContent = '#...';

        loadProfile().then(() => loadUsers());
    } else if (event === 'SIGNED_OUT') {
        isAppInitialized = false;
        location.reload();
    }
});