// Simple client-side shopping assistant
const CHAT_API = 'http://localhost:4000/api';

function chatRenderIntro(container){
  const intro = document.createElement('div');
  intro.className = 'msg bot';
  intro.innerHTML = `Hi! I can help you find jewelry. Try: <div class="quick-replies">
    <button data-q="gold ring under 20000">Gold rings under 20k</button>
    <button data-q="silver earrings">Silver earrings</button>
    <button data-q="pendant under 10000">Pendants under 10k</button>
    <button data-q="bracelet">Bracelets</button>
  </div>`;
  container.appendChild(intro);
}

function parseIntent(text){
  const t = text.toLowerCase();
  const categories = ['ring','earrings','necklace','pendant','bracelet','bangle','anklet'];
  const metals = ['gold','silver','platinum','rose gold'];
  const cat = categories.find(c=> t.includes(c));
  const met = metals.find(m=> t.includes(m));
  let maxPrice = null;
  const m = t.match(/(under|below|less than|<)\s*(\d{3,6})/);
  if(m){ maxPrice = parseInt(m[2],10); }
  return { category: cat, metal: met, maxPrice };
}

async function fetchProducts(q=''){
  const url = q? `${CHAT_API}/products?q=${encodeURIComponent(q)}` : `${CHAT_API}/products`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Fetch failed');
  return await res.json();
}

async function searchProducts(intent, freeText){
  // Start with server filter by name/desc text if provided
  const seed = await fetchProducts(freeText);
  let items = seed;
  if(intent.category){ items = items.filter(p => (p.category||'').toLowerCase().includes(intent.category)); }
  if(intent.metal){ items = items.filter(p => (p.metal||'').toLowerCase().includes(intent.metal)); }
  if(intent.maxPrice){ items = items.filter(p => Number(p.price) <= intent.maxPrice); }
  return items.slice(0,6); // top 6 suggestions
}

function renderMessage(container, text, who='bot'){
  const div = document.createElement('div');
  div.className = `msg ${who}`;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function renderResults(container, items){
  if(items.length === 0){ renderMessage(container, 'No matching items found. Try a different query.'); return; }
  items.forEach(p=>{
    const card = document.createElement('div');
    card.className = 'result p-2';
    card.innerHTML = `
      <img src="${p.image_url}" alt="${p.name}">
      <div class="flex-grow-1">
        <div><strong>${p.name}</strong></div>
        <div class="meta">₹ ${Number(p.price).toLocaleString()} • ${(p.metal||'')} • ${(p.category||'')}</div>
        <div class="result-actions mt-1">
          <a class="btn btn-sm btn-outline-primary" href="product.html?id=${p.id}">View</a>
          <button class="btn btn-sm btn-success" data-id="${p.id}">Add to Cart</button>
        </div>
      </div>`;
    // add handler for add to cart
    card.querySelector('button').addEventListener('click', async (e)=>{
      const id = Number(e.currentTarget.dataset.id);
      try{
        const res = await fetch(`${CHAT_API}/cart/items`, {
          method:'POST', credentials:'include',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ product_id: id, quantity: 1 })
        });
        const data = await res.json();
        if(!res.ok) return alert(data.error || 'Failed to add');
        if(typeof getCartCount === 'function'){
          const count = await getCartCount();
          const el = document.querySelector('#cartBtn .cart-count');
          if(el) el.textContent = count>0? `(${count})` : '';
        }
        alert('Added to cart');
      }catch(err){ alert('Failed to add'); }
    });
    container.appendChild(card);
  });
  container.scrollTop = container.scrollHeight;
}

function mountChatbot(){
  if(document.getElementById('chatbot-toggle')) return; // already mounted
  // Toggle button
  const toggle = document.createElement('button');
  toggle.id = 'chatbot-toggle';
  toggle.className = 'btn btn-primary';
  toggle.innerHTML = '💬';
  document.body.appendChild(toggle);
  // Panel
  const panel = document.createElement('div');
  panel.id = 'chatbot-panel';
  panel.innerHTML = `
    <div id="chatbot-header">
      <strong>Shopping Assistant</strong>
      <button class="btn btn-sm btn-light" id="chatbot-close">✕</button>
    </div>
    <div id="chatbot-body"></div>
    <div id="chatbot-input">
      <input type="text" id="chatbot-text" class="form-control" placeholder="Ask for gold rings under 20k...">
      <button class="btn btn-primary" id="chatbot-send">Send</button>
    </div>`;
  document.body.appendChild(panel);

  const body = panel.querySelector('#chatbot-body');
  chatRenderIntro(body);

  function handleQuickClicks(){
    body.querySelectorAll('.quick-replies button').forEach(b=>{
      b.addEventListener('click', ()=>{
        const q = b.dataset.q;
        submitQuery(q);
      });
    });
  }
  handleQuickClicks();

  async function submitQuery(text){
    renderMessage(body, text, 'user');
    const intent = parseIntent(text);
    try{
      const items = await searchProducts(intent, text);
      renderResults(body, items);
    }catch(err){ renderMessage(body, 'Sorry, something went wrong fetching products.'); }
  }

  panel.querySelector('#chatbot-send').addEventListener('click', ()=>{
    const input = panel.querySelector('#chatbot-text');
    const text = input.value.trim();
    if(!text) return;
    input.value='';
    submitQuery(text);
  });
  panel.querySelector('#chatbot-text').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ panel.querySelector('#chatbot-send').click(); }
  });

  // Toggle
  toggle.addEventListener('click', ()=>{
    panel.classList.toggle('open');
  });
  panel.querySelector('#chatbot-close').addEventListener('click', ()=>{
    panel.classList.remove('open');
  });
}

// Auto-mount when CSS is present
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', mountChatbot);
}else{
  mountChatbot();
}
