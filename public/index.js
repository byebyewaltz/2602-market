// Market — vanilla SPA. JWT held in memory only; attached as a Bearer token.

const state = {
  token: null,
  username: null,
  route: "shelf",
  products: [],
  orders: [],
};

// ---------- API layer ----------
async function api(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && state.token) headers["Authorization"] = `Bearer ${state.token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* token routes return a raw string */
  }
  if (!res.ok) {
    const msg = typeof data === "string" && data ? data : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

// ---------- small DOM helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return node;
};
const money = (n) => `$${Number(n).toFixed(2)}`;

let toastTimer;
function toast(message, isError = false) {
  const t = $("#toast");
  t.textContent = message;
  t.classList.toggle("err", isError);
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ---------- routing ----------
function navigate(route) {
  if (route === "orders" && !state.token) route = "account";
  state.route = route;
  document.querySelectorAll(".nav-link").forEach((b) =>
    b.classList.toggle("active", b.dataset.route === route)
  );
  render();
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-route]");
  if (link) {
    e.preventDefault();
    navigate(link.dataset.route);
  }
  if (e.target.closest("[data-close-drawer]")) closeDrawer();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});

// ---------- account header ----------
function renderAccountSlot() {
  const slot = $("#account-slot");
  slot.innerHTML = "";
  if (state.token) {
    document.body.classList.add("is-authed");
    slot.append(
      el("span", { class: "who" }, "signed in as ", el("strong", {}, state.username)),
      el("button", { class: "btn ghost small", onclick: signOut }, "Sign out")
    );
  } else {
    document.body.classList.remove("is-authed");
    slot.append(
      el("button", { class: "btn small", "data-route": "account" }, "Sign in")
    );
  }
}

function signOut() {
  state.token = null;
  state.username = null;
  state.orders = [];
  renderAccountSlot();
  toast("Signed out.");
  navigate("shelf");
}

// ---------- views ----------
function render() {
  renderAccountSlot();
  const view = $("#view");
  view.innerHTML = "";
  if (state.route === "shelf") return renderShelf(view);
  if (state.route === "account") return renderAccount(view);
  if (state.route === "orders") return renderLedger(view);
}

// Shelf — GET /products
async function renderShelf(view) {
  view.append(
    el("div", { class: "page-head" },
      el("p", { class: "eyebrow" }, "Open stock"),
      el("h1", { class: "page-title" }, "The shelf"),
      el("p", { class: "page-note" }, "Everything currently in the shop. Open any item to read it in full or add it to one of your orders.")
    )
  );
  const grid = el("div", { class: "shelf-grid" });
  view.append(grid);
  grid.append(el("p", { class: "loading" }, "Pulling stock…"));

  try {
    state.products = await api("/products");
    grid.innerHTML = "";
    if (!state.products.length) {
      grid.append(el("div", { class: "empty" }, el("h3", {}, "Nothing on the shelf yet")));
      return;
    }
    state.products.forEach((p) => {
      grid.append(
        el("button", { class: "shelf-item", onclick: () => openProduct(p.id) },
          el("span", { class: "shelf-sku" }, `№ ${String(p.id).padStart(3, "0")}`),
          el("span", { class: "shelf-name" }, p.title),
          el("span", { class: "shelf-desc" }, p.description),
          el("span", { class: "shelf-price" }, money(p.price), el("span", { class: "price-unit" }, " ea"))
        )
      );
    });
  } catch (err) {
    grid.innerHTML = "";
    grid.append(el("div", { class: "empty" }, el("h3", {}, "Couldn't load the shelf"), err.message));
  }
}

// Product drawer — GET /products/:id, plus GET /products/:id/orders when signed in
async function openProduct(id) {
  const drawer = $("#drawer");
  const body = $("#drawer-body");
  drawer.setAttribute("aria-hidden", "false");
  body.innerHTML = '<p class="loading">Opening…</p>';

  try {
    const p = await api(`/products/${id}`);
    body.innerHTML = "";
    body.append(
      el("p", { class: "dp-sku" }, `№ ${String(p.id).padStart(3, "0")}`),
      el("h2", { class: "dp-name", id: "drawer-title" }, p.title),
      el("p", { class: "dp-price" }, money(p.price)),
      el("p", { class: "dp-desc" }, p.description)
    );

    if (!state.token) {
      body.append(
        el("p", { class: "dp-section-label" }, "Add to an order"),
        el("p", { class: "auth-hint" }, "Sign in to start an order and add this item."),
        el("button", { class: "btn terra", style: "margin-top:.7rem", onclick: () => { closeDrawer(); navigate("account"); } }, "Sign in")
      );
      return;
    }

    // Need the user's orders to offer a target + to show which already include this
    if (!state.orders.length) {
      try { state.orders = await api("/orders", { auth: true }); } catch { /* ignore */ }
    }

    body.append(el("p", { class: "dp-section-label" }, "Add to an order"));

    if (!state.orders.length) {
      body.append(
        el("p", { class: "auth-hint" }, "You have no open orders yet."),
        el("button", { class: "btn", style: "margin-top:.6rem", onclick: () => { closeDrawer(); navigate("orders"); } }, "Start one in your ledger")
      );
    } else {
      const select = el("select", { id: "add-order-select" },
        ...state.orders.map((o) =>
          el("option", { value: o.id }, `№ ${String(o.id).padStart(4, "0")} · ${fmtDate(o.date)}`)
        )
      );
      const qty = el("input", { id: "add-qty", type: "number", min: "1", value: "1" });
      const addBtn = el("button", { class: "btn terra small" }, "Add");
      addBtn.addEventListener("click", () => addToOrder(p, select.value, qty.value, addBtn));

      body.append(
        el("div", { class: "add-row" },
          el("div", { class: "field" }, el("label", { for: "add-order-select" }, "Order"), select),
          el("div", { class: "field" }, el("label", { for: "add-qty" }, "Qty"), qty),
          addBtn
        )
      );
    }

    // Which of the user's orders already include this product
    const incLabel = el("p", { class: "dp-section-label" }, "Already in your orders");
    const incBox = el("div", {}, el("p", { class: "auth-hint" }, "Checking…"));
    body.append(incLabel, incBox);
    try {
      const including = await api(`/products/${p.id}/orders`, { auth: true });
      incBox.innerHTML = "";
      if (!including.length) {
        incBox.append(el("p", { class: "auth-hint" }, "None of your orders include this yet."));
      } else {
        incBox.append(
          el("ul", { class: "included-list" },
            ...including.map((o) =>
              el("li", {}, el("span", {}, `№ ${String(o.id).padStart(4, "0")}`), el("span", {}, fmtDate(o.date)))
            )
          )
        );
      }
    } catch {
      incBox.innerHTML = "";
      incBox.append(el("p", { class: "auth-hint" }, "Couldn't check your orders."));
    }
  } catch (err) {
    body.innerHTML = "";
    body.append(el("div", { class: "empty" }, el("h3", {}, "Not found"), err.message));
  }
}

// POST /orders/:id/products
async function addToOrder(product, orderId, quantity, btn) {
  const q = parseInt(quantity, 10);
  if (!Number.isInteger(q) || q < 1) return toast("Enter a quantity of 1 or more.", true);
  btn.disabled = true;
  try {
    await api(`/orders/${orderId}/products`, {
      method: "POST",
      auth: true,
      body: { productId: product.id, quantity: q },
    });
    toast(`Added ${q} × ${product.title} to order №${String(orderId).padStart(4, "0")}.`);
    if (state.route === "orders") loadOrdersInto(); // refresh receipts if visible
    openProduct(product.id); // refresh "already in your orders"
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

function closeDrawer() {
  $("#drawer").setAttribute("aria-hidden", "true");
}

// Account — POST /users/register, POST /users/login
function renderAccount(view) {
  let mode = "login";

  const wrap = el("div", { class: "auth-wrap" });
  view.append(
    el("div", { class: "page-head" },
      el("p", { class: "eyebrow" }, "Account"),
      el("h1", { class: "page-title" }, "Keep your ledger")
    ),
    wrap
  );

  function paint() {
    wrap.innerHTML = "";
    const card = el("div", { class: "auth-card" });
    const tabs = el("div", { class: "auth-tabs" },
      el("button", { class: `auth-tab ${mode === "login" ? "active" : ""}`, onclick: () => { mode = "login"; paint(); } }, "Sign in"),
      el("button", { class: `auth-tab ${mode === "register" ? "active" : ""}`, onclick: () => { mode = "register"; paint(); } }, "Register")
    );
    const uname = el("input", { type: "text", autocomplete: "username", placeholder: "e.g. admin" });
    const pword = el("input", { type: "password", autocomplete: "current-password", placeholder: "••••••••" });
    const submit = el("button", { class: "btn terra" }, mode === "login" ? "Sign in" : "Create account");

    const go = async () => {
      const username = uname.value.trim();
      const password = pword.value;
      if (!username || !password) return toast("Username and password are both required.", true);
      submit.disabled = true;
      try {
        const path = mode === "login" ? "/users/login" : "/users/register";
        const token = await api(path, { method: "POST", body: { username, password } });
        state.token = typeof token === "string" ? token : String(token);
        state.username = username;
        state.orders = [];
        toast(mode === "login" ? "Welcome back." : "Account created.");
        navigate("orders");
      } catch (err) {
        toast(err.message, true);
      } finally {
        submit.disabled = false;
      }
    };
    submit.addEventListener("click", go);
    pword.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });

    card.append(
      tabs,
      el("div", { class: "field" }, el("label", {}, "Username"), uname),
      el("div", { class: "field" }, el("label", {}, "Password"), pword),
      submit,
      el("p", { class: "auth-hint" }, mode === "login" ? "New here? Switch to Register." : "Your password is hashed before it's stored.")
    );
    wrap.append(card);
  }
  paint();
}

// Ledger — POST /orders, GET /orders, GET /orders/:id/products (per receipt)
async function renderLedger(view) {
  const noteInput = el("input", { type: "text", placeholder: "what's this order for?", style: "width:200px;font-family:var(--body)" });
  const dateInput = el("input", { type: "date", value: today() });
  const openBtn = el("button", { class: "btn terra" }, "Open order");
  openBtn.addEventListener("click", async () => {
    if (!dateInput.value) return toast("Pick a date for the order.", true);
    openBtn.disabled = true;
    try {
      await api("/orders", { method: "POST", auth: true, body: { date: dateInput.value, note: noteInput.value.trim() || null } });
      noteInput.value = "";
      toast("Order opened.");
      loadOrdersInto();
    } catch (err) {
      toast(err.message, true);
    } finally {
      openBtn.disabled = false;
    }
  });

  view.append(
    el("div", { class: "ledger-top" },
      el("div", { class: "page-head", style: "margin-bottom:0" },
        el("p", { class: "eyebrow" }, "Your ledger"),
        el("h1", { class: "page-title" }, "Orders, kept as receipts")
      ),
      el("div", { class: "new-order" },
        el("div", { class: "field" }, el("label", {}, "Date"), dateInput),
        el("div", { class: "field" }, el("label", {}, "Note"), noteInput),
        openBtn
      )
    ),
    el("div", { id: "receipts-mount" })
  );
  loadOrdersInto();
}

async function loadOrdersInto() {
  const mount = $("#receipts-mount");
  if (!mount) return;
  mount.innerHTML = '<p class="loading">Reading the ledger…</p>';
  try {
    state.orders = await api("/orders", { auth: true });
    mount.innerHTML = "";
    if (!state.orders.length) {
      mount.append(
        el("div", { class: "empty" },
          el("h3", {}, "No orders yet"),
          "Open your first order above, then add items from the shelf."
        )
      );
      return;
    }
    const grid = el("div", { class: "receipts" });
    mount.append(grid);
    // Render each receipt; fetch its line items (GET /orders/:id/products)
    for (const order of state.orders) {
      const card = el("div", { class: "receipt" });
      grid.append(card);
      renderReceipt(card, order);
    }
  } catch (err) {
    mount.innerHTML = "";
    mount.append(el("div", { class: "empty" }, el("h3", {}, "Couldn't read your ledger"), err.message));
  }
}

async function renderReceipt(card, order) {
  card.append(
    el("div", { class: "receipt-head" },
      el("span", { class: "receipt-no" }, `№ ${String(order.id).padStart(4, "0")}`),
      el("span", { class: "receipt-date" }, fmtDate(order.date))
    )
  );
  if (order.note) card.append(el("p", { class: "receipt-note" }, `“${order.note}”`));

  const lines = el("div", { class: "receipt-lines" }, el("p", { class: "receipt-empty" }, "Tallying…"));
  card.append(lines);

  try {
    const items = await api(`/orders/${order.id}/products`, { auth: true });
    lines.innerHTML = "";
    if (!items.length) {
      lines.append(el("p", { class: "receipt-empty" }, "No items yet — add some from the shelf."));
    } else {
      let total = 0;
      items.forEach((it) => {
        const lineTotal = Number(it.price) * it.quantity;
        total += lineTotal;
        lines.append(
          el("div", { class: "receipt-line" },
            el("span", {}, el("span", { class: "q" }, `${it.quantity}× `), it.title),
            el("span", { class: "amt" }, money(lineTotal))
          )
        );
      });
      card.append(
        el("div", { class: "receipt-total" },
          el("span", { class: "label" }, "Total"),
          el("span", { class: "sum" }, money(total))
        )
      );
    }
  } catch (err) {
    lines.innerHTML = "";
    lines.append(el("p", { class: "receipt-empty" }, "Couldn't load items."));
  }
  card.append(el("p", { class: "receipt-foot" }, "— thank you · Market —"));
}

// ---------- date utils ----------
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(value) {
  // value may be an ISO string or YYYY-MM-DD; render without timezone drift
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y) return s;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[(m || 1) - 1]} ${d}, ${y}`;
}

// ---------- boot ----------
render();
