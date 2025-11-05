// Shared frontend logic: auth state, cart indicator, and helpers
const API = 'http://localhost:4000/api';

async function getMe(){
  try{
    const res = await fetch(`${API}/auth/me`, { credentials:'include' });
    if(!res.ok) return null;
    return await res.json();
  }catch(e){ return null; }
}

async function getCartCount(){
  try{
    const res = await fetch(`${API}/cart`, { credentials:'include' });
    if(!res.ok) return 0;
    const data = await res.json();
    return (data.items||[]).reduce((s,i)=> s + (i.quantity||0), 0);
  }catch(e){ return 0; }
}

async function setupNavbar(){
  try{
    const [user, count] = await Promise.all([getMe(), getCartCount()]);
    const navUser = document.getElementById('navUser');
    const navAuth = document.getElementById('navAuth');
    const cartBtn = document.getElementById('cartBtn');
    if(cartBtn) cartBtn.querySelector('.cart-count').textContent = count>0? `(${count})` : '';
    if(user){
      if(navUser) navUser.innerHTML = `<span class=\"me-2\">Hi, ${user.name}</span><button id=\"logoutBtn\" class=\"btn btn-sm btn-outline-secondary\">Logout</button>`;
      if(navAuth) navAuth.remove();
      const logoutBtn = document.getElementById('logoutBtn');
      if(logoutBtn){
        logoutBtn.addEventListener('click', async ()=>{
          await fetch(`${API}/auth/logout`, { method:'POST', credentials:'include' });
          location.href = 'index.html';
        });
      }
    }
  }catch(e){ /* noop */ }
}

// Utility to redirect to homepage after login/register
async function redirectIfLoggedIn(){
  try{
    const user = await getMe();
    if(user) location.href = 'index.html';
  }catch(e){ /* noop */ }
}
