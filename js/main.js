let messageChannel = null;

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split('/').pop();
    
    if (path === 'login.html' && document.getElementById('login-form')) {
        handleLoginForm();
    } else if (path === 'signup.html' && document.getElementById('signup-form')) {
        handleSignupForm();
    } else if (path === 'onboarding.html') {
        checkUserStatusAndProtectPage();
        handleApplicationForm();
    } else if (path === 'dashboard.html') {
        checkUserStatusAndProtectPage();
        loadDashboardData();
        handleTransferForm();
    } else if (path === 'support.html') {
        checkUserStatusAndProtectPage();
        handleSupportPage();
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (messageChannel) {
                supabase.removeChannel(messageChannel);
                messageChannel = null;
            }
            await supabase.auth.signOut();
            window.location.href = 'login.html';
        });
    }
});

async function checkUserStatusAndProtectPage() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', session.user.id)
        .single();

    const currentPage = window.location.pathname.split('/').pop();

    if (profile.status === 'approved' && (currentPage !== 'dashboard.html' && currentPage !== 'support.html')) {
        window.location.href = 'dashboard.html';
    } else if (profile.status === 'new' && currentPage !== 'onboarding.html') {
        window.location.href = 'onboarding.html';
    } else if (profile.status === 'pending_approval' && currentPage === 'onboarding.html') {
        document.getElementById('application-view').classList.add('hidden');
        document.getElementById('pending-view').classList.remove('hidden');
    } else if (profile.status === 'pending_approval' && currentPage !== 'onboarding.html') {
        window.location.href = 'onboarding.html';
    } else if (profile.status !== 'approved' && currentPage === 'support.html') {
        window.location.href = 'onboarding.html';
    }
}

function handleLoginForm() {
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            alert(error.message);
        } else {
            checkUserStatusAndProtectPage();
        }
    });
}

function handleSignupForm() {
    const signupForm = document.getElementById('signup-form');
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('full-name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
        });
        if (error) {
            alert(error.message);
        } else {
            alert('Signup successful! Please check your email for verification.');
            window.location.href = 'login.html';
        }
    });
}

function handleApplicationForm() {
    const appForm = document.getElementById('application-form');
    if (!appForm) return;
    appForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const applicationData = {
            application_type: document.getElementById('application-type').value,
            occupation: document.getElementById('occupation').value,
            account_purpose: document.getElementById('account-purpose').value,
            status: 'pending_approval'
        };

        const { error } = await supabase.from('profiles').update(applicationData).eq('id', user.id);
        if (error) {
            alert(error.message);
        } else {
            document.getElementById('application-view').classList.add('hidden');
            document.getElementById('pending-view').classList.remove('hidden');
        }
    });
}

async function loadDashboardData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
    document.getElementById('user-name').textContent = profile.full_name;

    const { data: account } = await supabase.from('accounts').select('balance').eq('user_id', user.id).single();
    document.getElementById('balance-amount').textContent = `$${Number(account.balance).toFixed(2)}`;
    
    document.getElementById('transaction-list').innerHTML = `<li>No recent transactions.</li>`;
}

function handleTransferForm() {
    const transferForm = document.getElementById('transfer-form');
    if (!transferForm) return;
    transferForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = document.getElementById('transfer-amount').value;
        alert(`This is a simulation. Transfer of $${amount} initiated.`);
        transferForm.reset();
    });
}

async function handleSupportPage() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    
    loadMessages(user.id);

    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (!content) return;

        await supabase.from('messages').insert({
            sender_id: user.id,
            content: content
        });
        messageInput.value = '';
    });

    if (messageChannel) {
        supabase.removeChannel(messageChannel);
    }
    
    messageChannel = supabase.channel(`messages_for_${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            if (payload.new.sender_id === user.id || payload.new.receiver_id === user.id) {
                 appendMessage(payload.new, user.id);
            }
        })
        .subscribe();
}

async function loadMessages(userId) {
    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching messages:', error);
        return;
    }

    const messageBox = document.getElementById('message-box');
    messageBox.innerHTML = '';
    messages.forEach(message => appendMessage(message, userId));
}

function appendMessage(message, currentUserId) {
    const messageBox = document.getElementById('message-box');
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.textContent = message.content;

    if (message.sender_id === currentUserId) {
        bubble.classList.add('sent');
    } else {
        bubble.classList.add('received');
    }

    messageBox.appendChild(bubble);
    messageBox.scrollTop = messageBox.scrollHeight;
}
