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
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
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

    if (profile.status === 'approved' && currentPage !== 'dashboard.html') {
        window.location.href = 'dashboard.html';
    } else if (profile.status === 'new' && currentPage !== 'onboarding.html') {
        window.location.href = 'onboarding.html';
    } else if (profile.status === 'pending_approval' && currentPage === 'onboarding.html') {
        document.getElementById('application-view').classList.add('hidden');
        document.getElementById('pending-view').classList.remove('hidden');
    } else if (profile.status === 'pending_approval' && currentPage !== 'onboarding.html') {
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
    
    // In a real app, transactions would be more complex
    document.getElementById('transaction-list').innerHTML = `<li>No recent transactions.</li>`;
}

function handleTransferForm() {
    // This is a simplified transfer feature for simulation
    const transferForm = document.getElementById('transfer-form');
    transferForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = document.getElementById('transfer-amount').value;
        alert(`This is a simulation. Transfer of $${amount} initiated.`);
        transferForm.reset();
    });
}
