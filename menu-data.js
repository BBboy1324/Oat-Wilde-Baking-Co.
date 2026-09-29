// Shared menu data store backed by Supabase (Postgres + Auth) so edits show up for every visitor.
// Requires supabase-config.js (loaded before this file) with your project's URL/anon key.
const MENU_TABLE = "menu_data";
const MENU_ROW_ID = 1;

const DEFAULT_MENU_ITEMS = [
  { id: "item-1", name: "Country sourdough", description: "Our everyday loaf: a crisp, blistered crust and a soft, gently tangy crumb.", price: "9.00", image: "", available: true },
  { id: "item-2", name: "Seeded sourdough", description: "Country dough with toasted seeds folded through for a nutty, hearty bite.", price: "10.00", image: "", available: true },
  { id: "item-3", name: "Olive oil focaccia", description: "Soft-centered, golden at the edges, finished with good olive oil and flaky salt.", price: "8.00", image: "", available: true },
  { id: "item-4", name: "Morning buns", description: "Buttery, flaky layers rolled in cinnamon sugar. Lovely with the first cup of coffee.", price: "5.50", image: "", available: true },
  { id: "item-5", name: "Brown butter shortbread", description: "Crumbly, tender biscuits with toasted butter and just a little sea salt.", price: "4.50", image: "", available: true },
  { id: "item-6", name: "Seasonal fruit galette", description: "Whatever is ripe and lovely, tucked into a rough-edged, all-butter pastry.", price: "7.50", image: "", available: true }
];

let supabaseClient = null;
let supabaseReady = false;

function initSupabase() {
  if (supabaseReady) return;
  const config = window.SUPABASE_CONFIG;
  if (typeof window.supabase === "undefined" || !config || !config.url || config.url === "YOUR_SUPABASE_URL") {
    console.warn("Supabase isn't configured yet (see supabase-config.js). Showing default menu items only.");
    return;
  }
  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  supabaseReady = true;
}

initSupabase();

function makeMenuItemId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Only allow safe image sources so a stored value can never execute script (e.g. javascript: URIs).
function isSafeImageSrc(src) {
  if (!src) return false;
  return /^https:\/\//i.test(src) || /^data:image\//i.test(src);
}

// Calls back immediately with current data, then again whenever the shared menu changes. Returns an unsubscribe function.
function subscribeMenuItems(callback) {
  if (!supabaseReady) {
    callback(DEFAULT_MENU_ITEMS.map((item) => ({ ...item })));
    return () => {};
  }

  const emit = async () => {
    const { data, error } = await supabaseClient.from(MENU_TABLE).select("items").eq("id", MENU_ROW_ID).maybeSingle();
    if (error) {
      console.error("Could not load menu items from Supabase.", error);
      callback(DEFAULT_MENU_ITEMS.map((item) => ({ ...item })));
      return;
    }
    if (data && Array.isArray(data.items)) {
      callback(data.items);
    } else {
      callback(DEFAULT_MENU_ITEMS.map((item) => ({ ...item })));
    }
  };

  emit();

  const channel = supabaseClient
    .channel("menu_data_changes")
    .on("postgres_changes", { event: "*", schema: "public", table: MENU_TABLE }, emit)
    .subscribe();

  return () => supabaseClient.removeChannel(channel);
}

const MAX_MENU_ROW_BYTES = 900000; // Keep well under Postgres' toast/row-size limits when storing pictures inline.

async function saveMenuItems(items) {
  if (!supabaseReady) {
    throw new Error("Supabase isn't configured — add your project settings to supabase-config.js.");
  }
  const size = new Blob([JSON.stringify(items)]).size;
  if (size > MAX_MENU_ROW_BYTES) {
    throw new Error("This is too much data to save (likely large uploaded pictures). Use image URLs instead of uploads, or use smaller pictures.");
  }
  const { error } = await supabaseClient.from(MENU_TABLE).upsert({ id: MENU_ROW_ID, items });
  if (error) throw new Error(error.message);
}

function signInAdmin(email, password) {
  if (!supabaseReady) return Promise.reject(new Error("Supabase isn't configured yet."));
  return supabaseClient.auth.signInWithPassword({ email, password }).then(({ error }) => {
    if (error) throw error;
  });
}

function signOutAdmin() {
  if (!supabaseReady) return Promise.resolve();
  return supabaseClient.auth.signOut();
}

// Calls back with the signed-in user (or null) immediately and on every auth change.
function onAdminAuthChanged(callback) {
  if (!supabaseReady) {
    callback(null);
    return () => {};
  }
  const { data } = supabaseClient.auth.onAuthStateChange((_event, session) => {
    callback(session ? session.user : null);
  });
  return () => data.subscription.unsubscribe();
}
