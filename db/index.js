// Market — front-end client for the Express API.
// Vanilla JS, no build step. Talks to the same-origin API the backend serves.

const API = ""; // same origin (server can serve /public statically)

// ---- tiny state ----
const state = {
  token: null,
  username: null,
  products: [],
  orders: [],
};

// ---- DOM helpers ----
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const k of kids) node.append(k?.nodeType ? k : document.createTextNode(k ?? ""));
  return node;
};
const money = (v) => Number(v).toFixed(2);

// ---- API layer ----
async function api(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;

  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* token/plain text */ }

  if (!res.ok) throw new ApiError(res.status, typeof data === "string" ? data : res.statusText);
  return data;
}
class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ---- toast ----
let toastTimer;
function toast(msg, isError = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast toast--show" + (isError ? " toast--err" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 2600);
}

/* ============================================================
   Masthead / session nav
   ============================================================ */
function renderNav() {
  const nav = $("#nav");
  nav.replaceChildren();
  if (state.token) {
    nav.append(
      el("span", { className: "who" }, "signed in as ", el("strong", {}, state.username)),
      el("button", { className: "btn btn--ghost btn--sm", onclick: signOut }, "Sign out")
    );
  } else {
    nav.append(el("span", { className: "who" }, "browsing as guest"));
  }
}

function signOut() {
  state.token = null;
  state.username = null;
  state.orders = [];
  renderNav();
  renderLedger();
  toast("Signed out.");
}

/* ============================================================
   Products (the shelf)
   ============================================================ */
async function loadProducts() {
  const grid = $("#products");
  grid.replaceChildren(...Array.from({ length: 6 }, () => el("div", { className: "skeleton" })));
  try {
    state.products = await api("/products");
    renderProducts();
  } catch (e) {
    grid.replaceChildren(el("p", { className: "empty" }, "Couldn't load the shelf. Is the server running?"));
  }
}

function renderProducts() {
  const grid = $("#products");
  if (!state.products.length) {
    grid.replaceChildren(el("p", { className: "empty" }, "The shelf is empty. Seed the database to stock it."));
    return;
  }
  grid.replaceChildren(
    ...state.products.map((p, i) => {
      const card = el(
        "button",
        { className: "product", onclick: () => openProduct(p.id) },
        el("span", { className: "product__no" }, `№ ${String(i + 1).padStart(2, "0")}`),
        el("h3", { className: "product__title" }, p.title),
        el("p", { className: "product__desc" }, p.description),
        el(
          "div",
          { className: "product__foot" },
          el("span", { className: "price" }, money(p.price)),
          el("span", { className: "product__cue" }, "View →")
        )
      );
      return card;
    })
  );
}

/* ============================================================
   Ledger panel — auth (logged out) OR orders (logged in)
   ============================================================ */
function renderLedger() {
  const body = $("#ledger-body");
  body.replaceChildren(state.token ? ordersPanel() : authPanel());
  if (state.token) loadOrders();
}

// ---- auth panel ----
function authPanel() {
  const wrap = el("div");
  wrap.append(el("div", { className: "ledger__label" }, "Your account", el("span", {}, "✎")));

  let mode = "login";
  const tabs = el(
    "div",
    { className: "tabs", role: "tablist" },
    tabBtn("Sign in", "login"),
    tabBtn("Register", "register")
  );
  function tabBtn(label, value) {
    const b = el("button", {
      className: "tab",
      role: "tab",
      type: "button",
      onclick: () => setMode(value),
    }, label);
    b.setAttribute("aria-selected", String(value === mode));
    b.dataset.mode = value;
    return b;
  }

  const userInput = inputField("Username", "username", "text");
  const passInput = inputField("Password", "password", "password");

  const submit = el("button", { className: "btn btn--accent btn--block", type: "button" });
  submit.textContent = "Sign in";

  function setMode(m) {
    mode = m;
    [...tabs.children].forEach((t) => t.setAttribute("aria-selected", String(t.dataset.mode === m)));
    submit.textContent = m === "login" ? "Sign in" : "Create account";
  }

  async function go() {
    const username = userInput.input.value.trim();
    const password = passInput.input.value;
    if (!username || !password) return toast("Enter a username and password.", true);

    submit.disabled = true;
    try {
      const path = mode === "login" ? "/users/login" : "/users/register";
      const token = await api(path, { method: "POST", body: { username, password } });
      state.token = token;
      state.username = username;
      renderNav();
      renderLedger();
      toast(mode === "login" ? `Welcome back, ${username}.` : `Account created — welcome, ${username}.`);
    } catch (e) {
      const msg =
        e.status === 401 ? "Those credentials don't match." :
        e.status === 400 ? "Username and password are required." :
        e.message || "Something went wrong.";
      toast(msg, true);
    } finally {
      submit.disabled = false;
    }
  }
  submit.onclick = go;
  passInput.input.addEventListener("keydown", (ev) => ev.key === "Enter" && go());

  wrap.append(tabs, userInput.field, passInput.field, submit);
  return wrap;
}

function inputField(label, id, type) {
  const input = el("input", { id: `f-${id}`, type, autocomplete: type === "password" ? "current-password" : "username" });
  const field = el("div", { className: "field" }, el("label", { htmlFor: `f-${id}` }, label), input);
  return { field, input };
}

// ---- orders panel ----
function ordersPanel() {
  const wrap = el("div");
  wrap.append(el("div", { className: "ledger__label" }, "Your ledger", el("span", {}, "✻")));

  // New order form
  const dateInput = el("input", { type: "date", id: "no-date", value: new Date().toISOString().slice(0, 10) });
  const noteInput = el("input", { type: "text", id: "no-note", placeholder: "optional note" });
  const addBtn = el("button", { className: "btn btn--block btn--sm", type: "button" }, "Open a new order");
  addBtn.onclick = async () => {
    if (!dateInput.value) return toast("Pick a date for the order.", true);
    addBtn.disabled = true;
    try {
      await api("/orders", { method: "POST", auth: true, body: { date: dateInput.value, note: noteInput.value || undefined } });
      noteInput.value = "";
      toast("Order opened.");
      loadOrders();
    } catch (e) {
      toast(e.status === 400 ? "A date is required." : e.message, true);
    } finally {
      addBtn.disabled = false;
    }
  };
  const neworder = el(
    "div",
    { className: "neworder" },
    el("div", { className: "field" }, el("label", { htmlFor: "no-date" }, "Date"), dateInput),
    el("div", { className: "field" }, el("label", { htmlFor: "no-note" }, "Note"), noteInput),
    addBtn
  );

  const listHead = el("p", { className: "subhead" }, "Past orders");
  const list = el("div", { className: "orders", id: "orders-list" }, el("p", { className: "empty" }, "Loading…"));

  wrap.append(neworder, listHead, list);
  return wrap;
}

async function loadOrders() {
  let list = $("#orders-list");
  if (!list) return;
  try {
    state.orders = await api("/orders", { auth: true });
    list = $("#orders-list");
    if (!list) return;
    if (!state.orders.length) {
      list.replaceChildren(el("p", { className: "empty" }, "No orders yet. Open one above, then add items from the shelf."));
      return;
    }
    list.replaceChildren(
      ...state.orders.map((o) =>
        el(
          "button",
          { className: "order-row", onclick: () => openOrder(o.id) },
          el(
            "span",
            {},
            el("span", { className: "order-row__date" }, formatDate(o.date)),
            o.note ? el("span", { className: "order-row__note" }, ` · ${o.note}`) : ""
          ),
          el("span", { className: "order-row__no" }, `#${o.id}`)
        )
      )
    );
  } catch (e) {
    if (list) list.replaceChildren(el("p", { className: "empty" }, "Couldn't load your orders."));
  }
}

function formatDate(d) {
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/* ============================================================
   Drawer — product detail & order detail
   ============================================================ */
const drawer = $("#drawer");
function openDrawer(node) {
  $("#drawer-content").replaceChildren(node);
  drawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  $(".drawer__close").focus();
}
function closeDrawer() {
  drawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
drawer.addEventListener("click", (e) => { if (e.target.dataset.close !== undefined) closeDrawer(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.getAttribute("aria-hidden") === "false") closeDrawer(); });

// ---- product detail ----
async function openProduct(id) {
  let product;
  try { product = await api(`/products/${id}`); }
  catch (e) { return toast(e.status === 404 ? "That product is gone." : e.message, true); }

  const idx = state.products.findIndex((p) => p.id === id);
  const content = el("div", { className: "detail" });
  content.append(
    el("span", { className: "detail__no" }, `№ ${String(idx + 1).padStart(2, "0")} · in stock`),
    el("h2", { className: "detail__title", id: "drawer-title" }, product.title),
    el("p", { className: "detail__desc" }, product.description),
    el("div", { className: "detail__price" }, money(product.price))
  );

  if (state.token) {
    content.append(el("hr", { className: "divider" }), addToOrderBox(product));
    // Show which of the user's orders already include this product
    content.append(historySlot(product.id));
  } else {
    content.append(
      el("hr", { className: "divider" }),
      el("div", { className: "locked" },
        el("p", {}, "Sign in to add this to an order and track your purchases."))
    );
  }
  openDrawer(content);
}

function addToOrderBox(product) {
  const box = el("div", { className: "addbox" });
  const select = el("select", { id: "add-order" });
  const qty = el("input", { type: "number", min: "1", value: "1", id: "add-qty" });
  const btn = el("button", { className: "btn btn--accent btn--block btn--sm", type: "button" }, "Add to order");

  // Populate with the user's orders
  if (state.orders.length) {
    select.append(...state.orders.map((o) =>
      el("option", { value: String(o.id) }, `#${o.id} · ${formatDate(o.date)}${o.note ? " · " + o.note : ""}`)
    ));
  } else {
    select.append(el("option", { value: "" }, "— no orders yet —"));
    select.disabled = true;
    btn.disabled = true;
  }

  btn.onclick = async () => {
    const orderId = select.value;
    const quantity = parseInt(qty.value, 10);
    if (!orderId) return toast("Open an order first.", true);
    if (!quantity || quantity < 1) return toast("Quantity must be at least 1.", true);
    btn.disabled = true;
    try {
      await api(`/orders/${orderId}/products`, {
        method: "POST", auth: true, body: { productId: product.id, quantity },
      });
      toast(`Added ${quantity} × ${product.title} to order #${orderId}.`);
      refreshHistory(product.id);
    } catch (e) {
      const msg =
        e.status === 403 ? "That order isn't yours." :
        e.status === 404 ? "That order no longer exists." :
        e.status === 400 ? "Check the product and quantity." : e.message;
      toast(msg, true);
    } finally { btn.disabled = false; }
  };

  box.append(
    el("label", { htmlFor: "add-order" }, "Add to which order"),
    select,
    el("label", { htmlFor: "add-qty" }, "Quantity"),
    qty,
    btn
  );
  return box;
}

// "this product appears in these orders" — uses GET /products/:id/orders
function historySlot(productId) {
  const slot = el("div", { id: "phist" });
  slot.append(el("p", { className: "subhead" }, "Appears in your orders"));
  slot.append(el("p", { className: "empty", id: "phist-body" }, "Checking…"));
  refreshHistory(productId, slot);
  return slot;
}
async function refreshHistory(productId, slotRoot) {
  try {
    const orders = await api(`/products/${productId}/orders`, { auth: true });
    const body = (slotRoot || document).querySelector("#phist-body");
    if (!body) return;
    if (!orders.length) {
      body.replaceWith(el("p", { className: "empty", id: "phist-body" }, "Not in any of your orders yet."));
    } else {
      const list = el("div", { className: "orders" },
        ...orders.map((o) =>
          el("button", { className: "order-row", type: "button", onclick: () => { closeDrawer(); openOrder(o.id); } },
            el("span", { className: "order-row__date" }, formatDate(o.date)),
            el("span", { className: "order-row__no" }, `#${o.id}`)
          )
        )
      );
      body.replaceWith(Object.assign(list, { id: "phist-body" }));
    }
  } catch { /* leave as-is */ }
}

// ---- order detail (line items via GET /orders/:id/products) ----
async function openOrder(id) {
  let order, items;
  try {
    [order, items] = await Promise.all([
      api(`/orders/${id}`, { auth: true }),
      api(`/orders/${id}/products`, { auth: true }),
    ]);
  } catch (e) {
    return toast(
      e.status === 403 ? "That order isn't yours." :
      e.status === 404 ? "That order doesn't exist." : e.message, true
    );
  }

  const total = items.reduce((sum, p) => sum + Number(p.price) * p.quantity, 0);
  const content = el("div", { className: "detail" });
  content.append(
    el("span", { className: "detail__no" }, `Order #${order.id} · ${formatDate(order.date)}`),
    el("h2", { className: "detail__title", id: "drawer-title" }, order.note || "Untitled order")
  );

  if (!items.length) {
    content.append(el("p", { className: "empty" }, "Nothing in this order yet. Add items from the shelf."));
  } else {
    const table = el("table", { className: "lines" });
    table.append(
      el("thead", {}, el("tr", {},
        el("th", {}, "Item"),
        el("th", { className: "num" }, "Qty"),
        el("th", { className: "num" }, "Price"),
        el("th", { className: "num" }, "Sum")
      )),
      el("tbody", {}, ...items.map((p) =>
        el("tr", {},
          el("td", { className: "name" }, p.title),
          el("td", { className: "num" }, String(p.quantity)),
          el("td", { className: "num" }, money(p.price)),
          el("td", { className: "num" }, money(Number(p.price) * p.quantity))
        )
      )),
      el("tfoot", {}, el("tr", {},
        el("td", { colSpan: 3 }, "Total"),
        el("td", { className: "num" }, money(total))
      ))
    );
    content.append(table);
  }
  openDrawer(content);
}

/* ============================================================
   Boot
   ============================================================ */
renderNav();
renderLedger();
loadProducts();