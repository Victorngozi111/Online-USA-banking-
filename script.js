const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const authForm = document.getElementById('auth-form');
const docUploadForm = document.getElementById('doc-upload-form');
const authButton = document.getElementById('auth-button');
const toggleAuthLink = document.getElementById('toggle-auth');
const fullnameField = document.getElementById('fullname-field');
const formTitle = document.getElementById('form-title');

const views = document.querySelectorAll('.view');
let isLogin = true;

const switchView = (viewId) => {
    views.forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
};

toggleAuthLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLogin = !isLogin;
    formTitle.textContent = isLogin ? 'Login' : 'Sign Up';
    authButton.textContent = isLogin ? 'Login' : 'Sign Up';
    fullnameField.classList.toggle('hidden', isLogin);
    toggleAuthLink.innerHTML = isLogin ? 'Don\'t have an account? <a href="#">Sign Up</a>' : 'Already have an account? <a href="#">Login</a>';
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
    } else {
        const fullName = document.getElementById('full-name').value;
        const { error } = await supabase.auth.signUp({ 
            email, 
            password, 
            options: { data: { full_name: fullName } }
        });
        if (error) alert(error.message);
        else alert('Signup successful! Please check your email to verify.');
    }
});

docUploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = supabase.auth.getUser();
    if (!user) return;

    const idFile = document.getElementById('id-document').files[0];
    const addressFile = document.getElementById('address-document').files[0];
    const userId = (await user).data.user.id;
    
    const { data: idData, error: idError } = await supabase.storage
        .from('documents')
        .upload(`${userId}/${idFile.name}`, idFile);
    
    if (idError) return alert(idError.message);

    const { data: addressData, error: addressError } = await supabase.storage
        .from('documents')
        .upload(`${userId}/${addressFile.name}`, addressFile);
    
    if (addressError) return alert(addressError.message);

    await supabase
      .from('profiles')
      .update({ 
          status: 'pending_verification', 
          id_document_url: idData.path,
          address_document_url: addressData.path
       })
      .eq('id', userId);

    checkUserStatus();
});

const checkUserStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('status, full_name')
            .eq('id', user.id)
            .single();

        if (profile) {
            document.getElementById('user-name').textContent = profile.full_name;
            if (profile.status === 'new') switchView('verification-view');
            else if (profile.status === 'pending_verification') switchView('pending-view');
            else if (profile.status === 'approved') {
                switchView('dashboard-view');
                loadDashboardData();
            }
        }
    } else {
        switchView('auth-view');
    }
};

const loadDashboardData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: account } = await supabase
        .from('accounts')
        .select('balance')
        .eq('user_id', user.id)
        .single();
    
    document.getElementById('balance-amount').textContent = `$${Number(account.balance).toFixed(2)}`;

    const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
    
    const txList = document.getElementById('transaction-list');
    txList.innerHTML = '';
    transactions.forEach(tx => {
        const li = document.createElement('li');
        li.textContent = `${tx.type.toUpperCase()}: $${tx.amount} - ${new Date(tx.created_at).toLocaleDateString()}`;
        txList.appendChild(li);
    });
};

document.getElementById('logout-pending').addEventListener('click', () => supabase.auth.signOut());
document.getElementById('logout-dashboard').addEventListener('click', () => supabase.auth.signOut());

supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        switchView('auth-view');
    } else if (event === 'SIGNED_IN') {
        checkUserStatus();
    }
});

checkUserStatus();