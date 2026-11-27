const SUPABASE_URL = 'https://xqzkpqjihzvcmngkrpzc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxemtwcWppaHp2Y21uZ2tycHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2MjMzMjEsImV4cCI6MjExMTE5OTMyMX0.uH7wyh-yElvHgH5uNiMziTHPaYCC8SmxzXuU1mHSpU8';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Проверяем авторизацию
(async () => {
    const { data: { user } } = await db.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Загружаем настройки
    let { data: settings } = await db
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (!settings) {
        const { data: newSettings } = await db
            .from('user_settings')
            .insert({ user_id: user.id })
            .select()
            .single();
        settings = newSettings;
    }

    // Заполняем форму
    document.getElementById('settingsTheme').value = settings?.theme || 'dark';
    document.getElementById('settingsFontSize').value = settings?.font_size || 14;
    document.getElementById('settingsSounds').checked = settings?.sounds !== false;
    document.getElementById('settingsNotifications').checked = settings?.notifications !== false;

    // Применяем тему сразу
    applyTheme(settings?.theme || 'dark');
    applyFontSize(settings?.font_size || 14);
})();

// Сохранение настроек
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return;

    const theme = document.getElementById('settingsTheme').value;
    const fontSize = parseInt(document.getElementById('settingsFontSize').value);
    const sounds = document.getElementById('settingsSounds').checked;
    const notifications = document.getElementById('settingsNotifications').checked;

    const { error } = await db
        .from('user_settings')
        .upsert({
            user_id: user.id,
            theme,
            font_size: fontSize,
            sounds,
            notifications,
            updated_at: new Date().toISOString()
        });

    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }

    applyTheme(theme);
    applyFontSize(fontSize);
    showToast('✅ Настройки сохранены!');
});

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

function applyFontSize(size) {
    document.documentElement.style.fontSize = size + 'px';
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}