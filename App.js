/* ─────────────────────────────────────────
   LEDGER — app.js
   Modular expense tracker logic
──────────────────────────────────────────── */

// ─────────────────────────────────────────
//  CONFIG & CONSTANTS
// ─────────────────────────────────────────
const STORAGE_KEY = 'ledger_v2_transactions';

const CATEGORIES = [
  { id: 'food',     label: 'Food',     emoji: '🍜', types: ['expense'] },
  { id: 'travel',   label: 'Travel',   emoji: '✈️',  types: ['expense'] },
  { id: 'shopping', label: 'Shopping', emoji: '🛍',  types: ['expense'] },
  { id: 'bills',    label: 'Bills',    emoji: '🧾', types: ['expense'] },
  { id: 'health',   label: 'Health',   emoji: '🌿', types: ['expense'] },
  { id: 'salary',   label: 'Salary',   emoji: '💼', types: ['income']  },
  { id: 'freelance',label: 'Freelance',emoji: '🖊',  types: ['income']  },
  { id: 'other',    label: 'Other',    emoji: '📦', types: ['income', 'expense'] },
];

// ─────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────
const State = {
  transactions: [],
  currentType:  'income',
  selectedCat:  null,
  pendingAction: null,

  init() {
    this.transactions = Storage.load();
  },
};

// ─────────────────────────────────────────
//  STORAGE MODULE
// ─────────────────────────────────────────
const Storage = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  },

  save(transactions) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      console.warn('Storage error:', e);
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};

// ─────────────────────────────────────────
//  FORMATTING MODULE
// ─────────────────────────────────────────
const Format = {
  currency(n) {
    return '₹' + Math.abs(n).toLocaleString('en-IN', {
      minimumFractionDigits:  2,
      maximumFractionDigits:  2,
    });
  },

  date(iso) {
    return new Date(iso).toLocaleDateString('en-IN', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    });
  },

  datetime() {
    const d = new Date();
    return d.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }) + '\n' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  },

  escHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};

// ─────────────────────────────────────────
//  VALIDATION MODULE
// ─────────────────────────────────────────
const Validator = {
  validate(amount, desc, cat) {
    let ok = true;
    this.clearAll();

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      this.showError('err-amount', 'amount');
      ok = false;
    }
    if (!desc.trim() || desc.trim().length < 2) {
      this.showError('err-desc', 'description');
      ok = false;
    }
    if (!cat) {
      this.showError('err-cat', null);
      ok = false;
    }
    return ok;
  },

  showError(msgId, inputId) {
    document.getElementById(msgId)?.classList.add('show');
    if (inputId) document.getElementById(inputId)?.classList.add('error');
  },

  clearAll() {
    ['err-amount', 'err-desc', 'err-cat'].forEach(id =>
      document.getElementById(id)?.classList.remove('show')
    );
    ['amount', 'description'].forEach(id =>
      document.getElementById(id)?.classList.remove('error')
    );
  },
};

// ─────────────────────────────────────────
//  SUMMARY MODULE
// ─────────────────────────────────────────
const Summary = {
  update() {
    const txs     = State.transactions;
    const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    this._animateTo('totalBalance', balance < 0 ? `− ${Format.currency(balance)}` : Format.currency(balance));
    this._animateTo('totalIncome',  Format.currency(income));
    this._animateTo('totalExpense', Format.currency(expense));
  },

  _animateTo(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    setTimeout(() => {
      el.textContent = val;
      el.style.transition = 'opacity 0.25s, transform 0.25s';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, 140);
  },
};

// ─────────────────────────────────────────
//  CATEGORY MODULE
// ─────────────────────────────────────────
const CategoryUI = {
  build() {
    const grid = document.getElementById('categoryGrid');
    if (!grid) return;

    const cats = CATEGORIES.filter(c => c.types.includes(State.currentType));
    grid.innerHTML = cats.map(c => `
      <button
        class="cat-btn${State.selectedCat === c.id ? ' selected' : ''}"
        data-cat="${c.id}"
        onclick="CategoryUI.select('${c.id}')"
      >
        <span class="cat-emoji">${c.emoji}</span>
        <span>${c.label}</span>
      </button>
    `).join('');
  },

  select(id) {
    State.selectedCat = id;
    this.build();
    document.getElementById('err-cat')?.classList.remove('show');
  },

  populate() {
    const sel = document.getElementById('filterCat');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="all">All categories</option>' +
      CATEGORIES.map(c => `<option value="${c.id}">${c.emoji} ${c.label}</option>`).join('');
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  },
};

// ─────────────────────────────────────────
//  TRANSACTION MODULE
// ─────────────────────────────────────────
const Transactions = {
  add() {
    const amount = document.getElementById('amount')?.value;
    const desc   = document.getElementById('description')?.value;

    if (!Validator.validate(amount, desc, State.selectedCat)) return;

    const tx = {
      id:     `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      type:   State.currentType,
      amount: parseFloat(parseFloat(amount).toFixed(2)),
      desc:   desc.trim(),
      cat:    State.selectedCat,
      date:   new Date().toISOString(),
    };

    State.transactions.unshift(tx);
    Storage.save(State.transactions);
    Summary.update();
    ListView.render();
    this._resetForm();

    Toast.show(
      tx.type === 'income' ? '✓ Income added' : '✓ Expense recorded',
      tx.type === 'income' ? '#4a7a5e' : '#b05555'
    );
  },

  remove(id) {
    State.transactions = State.transactions.filter(t => t.id !== id);
    Storage.save(State.transactions);
    Summary.update();
    ListView.render();
    Toast.show('Transaction removed');
  },

  clearAll() {
    State.transactions = [];
    Storage.save(State.transactions);
    Summary.update();
    ListView.render();
    Toast.show('All transactions cleared');
  },

  _resetForm() {
    document.getElementById('amount').value = '';
    document.getElementById('description').value = '';
    State.selectedCat = null;
    CategoryUI.build();
    Validator.clearAll();
  },
};

// ─────────────────────────────────────────
//  LIST VIEW MODULE
// ─────────────────────────────────────────
const ListView = {
  render() {
    const filterType = document.getElementById('filterType')?.value || 'all';
    const filterCat  = document.getElementById('filterCat')?.value  || 'all';

    let list = [...State.transactions];
    if (filterType !== 'all') list = list.filter(t => t.type === filterType);
    if (filterCat  !== 'all') list = list.filter(t => t.cat  === filterCat);

    const container = document.getElementById('txList');
    const empty     = document.getElementById('emptyState');
    if (!container || !empty) return;

    if (!list.length) {
      container.innerHTML = '';
      empty.classList.add('visible');
      return;
    }

    empty.classList.remove('visible');
    container.innerHTML = list.map(tx => this._renderItem(tx)).join('');
  },

  _renderItem(tx) {
    const cat  = CATEGORIES.find(c => c.id === tx.cat) || CATEGORIES.at(-1);
    const sign = tx.type === 'income' ? '+' : '−';
    return `
      <div class="tx-item" data-id="${tx.id}">
        <div class="tx-cat-icon">${cat.emoji}</div>
        <div class="tx-info">
          <div class="tx-desc">${Format.escHtml(tx.desc)}</div>
          <div class="tx-meta">
            <span class="tx-cat-tag">${cat.label}</span>
            <span class="tx-date">${Format.date(tx.date)}</span>
          </div>
        </div>
        <div class="tx-amount ${tx.type}">${sign} ${Format.currency(tx.amount)}</div>
        <button class="tx-delete" onclick="Modal.confirmDelete('${tx.id}')" title="Delete">✕</button>
      </div>
    `;
  },
};

// ─────────────────────────────────────────
//  TOAST MODULE
// ─────────────────────────────────────────
const Toast = {
  _timer: null,

  show(msg, dotColor = '#5a8f6b') {
    const el  = document.getElementById('toast');
    const dot = document.getElementById('toastDot');
    const txt = document.getElementById('toastMsg');
    if (!el) return;

    txt.textContent = msg;
    dot.style.background = dotColor;
    el.classList.add('show');

    clearTimeout(this._timer);
    this._timer = setTimeout(() => el.classList.remove('show'), 2800);
  },
};

// ─────────────────────────────────────────
//  MODAL MODULE
// ─────────────────────────────────────────
const Modal = {
  open(title, sub, confirmLabel, action) {
    State.pendingAction = action;
    document.getElementById('modalTitle').textContent  = title;
    document.getElementById('modalSub').textContent    = sub;
    document.getElementById('modalConfirmBtn').textContent = confirmLabel;
    document.getElementById('modalOverlay').classList.add('open');
  },

  close() {
    document.getElementById('modalOverlay').classList.remove('open');
    State.pendingAction = null;
  },

  confirm() {
    if (State.pendingAction) {
      State.pendingAction();
      State.pendingAction = null;
    }
    this.close();
  },

  confirmDelete(id) {
    this.open(
      'Delete transaction?',
      'This entry will be permanently removed from your records.',
      'Delete',
      () => Transactions.remove(id)
    );
  },

  confirmClearAll() {
    if (!State.transactions.length) return;
    this.open(
      'Clear all history?',
      'Every transaction will be permanently erased. This cannot be undone.',
      'Clear All',
      () => Transactions.clearAll()
    );
  },
};

// ─────────────────────────────────────────
//  TYPE TOGGLE
// ─────────────────────────────────────────
function setType(type) {
  State.currentType = type;
  State.selectedCat = null;

  const btnI = document.getElementById('btnIncome');
  const btnE = document.getElementById('btnExpense');

  btnI.className = 'toggle-btn' + (type === 'income'  ? ' active-income'  : '');
  btnE.className = 'toggle-btn' + (type === 'expense' ? ' active-expense' : '');

  document.getElementById('submitLabel').textContent = type === 'income' ? 'Add Income' : 'Add Expense';

  CategoryUI.build();
  Validator.clearAll();
}

// ─────────────────────────────────────────
//  HEADER DATE
// ─────────────────────────────────────────
function updateHeaderDate() {
  const el = document.getElementById('headerDate');
  if (!el) return;
  const parts = Format.datetime().split('\n');
  el.innerHTML = parts[0] + '<br>' + parts[1];
}

// ─────────────────────────────────────────
//  EVENT BINDINGS
// ─────────────────────────────────────────
function bindEvents() {
  // Modal overlay click-outside
  document.getElementById('modalOverlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) Modal.close();
  });

  // Modal confirm button
  document.getElementById('modalConfirmBtn')?.addEventListener('click', () => Modal.confirm());

  // Filter changes
  document.getElementById('filterType')?.addEventListener('change', () => ListView.render());
  document.getElementById('filterCat')?.addEventListener('change',  () => ListView.render());

  // Enter key submits form
  ['amount', 'description'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') Transactions.add();
    });
  });
}

// ─────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────
function init() {
  State.init();
  updateHeaderDate();
  setInterval(updateHeaderDate, 30_000);
  CategoryUI.populate();
  CategoryUI.build();
  Summary.update();
  ListView.render();
  bindEvents();
}

document.addEventListener('DOMContentLoaded', init);