/**
 * Media kit + painel de edição da dona (localStorage + IndexedDB).
 *
 * Desbloquear: long-press no logo · Ctrl+Shift+E · /#admin · link “editar” no rodapé.
 * Primeira vez: defina sua senha (mín. 4 caracteres).
 * Sugestão inicial: ramile2026
 *
 * Persistência:
 *   ramile_kit_pw_hash     — hash SHA-256 da senha
 *   ramile_kit_hidden      — ids de mídia ocultos
 *   ramile_kit_labels      — rótulos dos itens ocultos
 *   ramile_kit_text        — overrides de texto (innerHTML)
 *   ramile_kit_sizes       — tamanhos por id ({ id: "p"|"m"|"g" })
 *   ramile_kit_order       — ordem por grade ({ key: [ids] })
 *   ramile_kit_custom      — mídia custom (stories/photos metadata)
 *   ramile_kit_galleries   — overrides das galerias de nicho
 *   ramile_kit_images      — fotos trocadas ({ mediaId: { blobId } })
 *   ramile_kit_boxes       — caixas de texto ({ editId: { align, maxWidthRem, minHeightRem, xRem, yRem } })
 *   ramile_kit_seen_tip    — já viu a ajuda inicial
 *   ramile_kit_publish     — config GitHub Pages (user/repo/branch/token) só no localStorage
 * Sessão: sessionStorage ramile_kit_edit = "1"
 * IndexedDB ramile_kit_blobs — arquivos de vídeo/foto adicionados
 * Público: data/published.json (GitHub Pages) — fonte da verdade para visitantes
 */

const toggle = document.querySelector(".menu-toggle");
const menu = document.querySelector(".menu");

if (toggle && menu) {
  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

const DEFAULT_GALLERIES = {
  movimento: {
    title: "Movimento",
    items: [
      { type: "image", src: "assets/gym/gym-16.jpg", alt: "Treino" },
      { type: "image", src: "assets/gym/gym-15.jpg", alt: "Activewear" },
      { type: "image", src: "assets/gym/gym-10.jpg", alt: "Academia" },
      { type: "image", src: "assets/fitness-pump.jpg", alt: "Pump" },
      { type: "image", src: "assets/fitness-run.jpg", alt: "Corrida" },
      { type: "video", src: "assets/videos/story-02.mp4" },
      { type: "video", src: "assets/videos/story-03.mp4" },
      { type: "video", src: "assets/videos/story-05.mp4" },
      { type: "video", src: "assets/videos/story-06.mp4" },
      { type: "video", src: "assets/videos/story-11.mp4" },
    ],
  },
  casa: {
    title: "Casa & reforma",
    items: [
      { type: "image", src: "assets/lifestyle-1.jpg", alt: "Casa" },
      { type: "image", src: "assets/lifestyle-2.jpg", alt: "Decoração" },
      { type: "image", src: "assets/gallery-2.jpg", alt: "Rotina em casa" },
      { type: "image", src: "assets/lifestyle-3.jpg", alt: "Detalhes" },
    ],
  },
  chale: {
    title: "Chalé · Serra de Macaé",
    items: [
      { type: "image", src: "assets/lifestyle-2.jpg", alt: "Projeto chalé" },
      { type: "image", src: "assets/lifestyle-1.jpg", alt: "Construção e lar" },
      { type: "image", src: "assets/gallery-2.jpg", alt: "Obra e detalhes" },
    ],
  },
  viagens: {
    title: "Viagens & experiências",
    items: [
      { type: "image", src: "assets/lifestyle-food.jpg", alt: "Gastronomia" },
      { type: "image", src: "assets/lifestyle-food-collage.jpg", alt: "Food collage" },
      { type: "image", src: "assets/lifestyle-burger.jpg", alt: "Burger" },
      { type: "image", src: "assets/gym/gym-12.jpg", alt: "Ao ar livre" },
      { type: "video", src: "assets/videos/story-04.mp4" },
      { type: "video", src: "assets/videos/story-07.mp4" },
      { type: "video", src: "assets/videos/story-08.mp4" },
      { type: "video", src: "assets/videos/story-09.mp4" },
    ],
  },
  casal: {
    title: "Vida a dois",
    items: [
      { type: "video", src: "assets/videos/story-01.mp4" },
      { type: "video", src: "assets/videos/story-06.mp4" },
      { type: "image", src: "assets/lifestyle-food.jpg", alt: "Restaurante e experiências" },
      { type: "image", src: "assets/lifestyle-burger.jpg", alt: "Comida e delivery" },
      { type: "image", src: "assets/lifestyle-food-collage.jpg", alt: "Momentos do dia a dia" },
      { type: "image", src: "assets/gym/gym-12.jpg", alt: "Lifestyle a dois" },
    ],
  },
  beleza: {
    title: "Beleza real",
    items: [
      { type: "image", src: "assets/festival-3.jpg", alt: "Beleza" },
      { type: "image", src: "assets/festival-2.jpg", alt: "Cabelo e estética" },
      { type: "image", src: "assets/festival-1.jpg", alt: "Cuidados" },
      { type: "image", src: "assets/hero-editorial.jpg", alt: "Editorial" },
      { type: "image", src: "assets/about-portrait.jpg", alt: "Retrato" },
    ],
  },
};

function cloneGalleries(source) {
  return JSON.parse(JSON.stringify(source));
}

let nicheGalleries = cloneGalleries(DEFAULT_GALLERIES);

const galleryModal = document.getElementById("niche-gallery");
const galleryTitle = document.getElementById("niche-gallery-title");
const galleryBody = document.getElementById("niche-gallery-body");
let lastFocus = null;
let currentGalleryKey = null;
const objectUrlCache = new Map();

function pauseGalleryVideos() {
  if (!galleryBody) return;
  galleryBody.querySelectorAll("video").forEach((video) => {
    video.pause();
  });
}

function closeGallery() {
  if (!galleryModal || galleryModal.hidden) return;
  pauseGalleryVideos();
  galleryModal.hidden = true;
  document.body.classList.remove("gallery-open");
  currentGalleryKey = null;
  if (lastFocus) lastFocus.focus();
}

function bindSinglePlay(container, video) {
  video.addEventListener("play", () => {
    const roots = [
      container,
      document.getElementById("story-videos"),
      document.querySelector(".couple-grid"),
    ].filter(Boolean);
    roots.forEach((root) => {
      root.querySelectorAll("video").forEach((other) => {
        if (other !== video) other.pause();
      });
    });
  });
}

async function resolveMediaSrc(item) {
  if (!item) return "";
  if (item.dataUrl) return item.dataUrl;
  if (item.blobId) {
    if (objectUrlCache.has(item.blobId)) return objectUrlCache.get(item.blobId);
    const blob = await idbGetBlob(item.blobId);
    if (!blob) return item.src || "";
    const url = URL.createObjectURL(blob);
    objectUrlCache.set(item.blobId, url);
    return url;
  }
  return item.src || "";
}

async function openGallery(key, trigger) {
  const data = nicheGalleries[key];
  if (!data || !galleryModal || !galleryBody || !galleryTitle) return;

  lastFocus = trigger || document.activeElement;
  currentGalleryKey = key;
  galleryTitle.textContent = data.title;
  galleryBody.innerHTML = "";

  const editing = document.body.classList.contains("edit-mode");

  for (let index = 0; index < data.items.length; index += 1) {
    const item = data.items[index];
    const figure = document.createElement("figure");
    figure.className = "niche-gallery-item";
    figure.dataset.galleryIndex = String(index);

    const src = await resolveMediaSrc(item);
    if (item.type === "video") {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = src;
      bindSinglePlay(galleryBody, video);
      figure.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = src;
      img.alt = item.alt || "";
      figure.appendChild(img);
    }

    if (editing) {
      figure.draggable = true;
      figure.classList.add("niche-gallery-editable");
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "niche-item-remove";
      removeBtn.setAttribute("aria-label", "Remover da galeria");
      removeBtn.title = "Remover";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeGalleryItem(key, index);
      });
      figure.appendChild(removeBtn);
    }

    galleryBody.appendChild(figure);
  }

  if (editing) {
    setupGalleryDrag(key);
    let tools = galleryModal.querySelector(".niche-admin-tools");
    if (!tools) {
      tools = document.createElement("div");
      tools.className = "niche-admin-tools";
      const dialog = galleryModal.querySelector(".niche-modal-dialog");
      if (dialog) dialog.appendChild(tools);
    }
    tools.hidden = false;
    tools.innerHTML = "";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn primary admin-add-btn";
    addBtn.textContent = "+ Adicionar foto ou vídeo";
    addBtn.addEventListener("click", () => pickGalleryFile(key));
    const hint = document.createElement("p");
    hint.className = "niche-admin-hint";
    hint.textContent = "Arraste os itens para reordenar. O × remove da aba.";
    tools.append(addBtn, hint);
  } else {
    const tools = galleryModal.querySelector(".niche-admin-tools");
    if (tools) tools.hidden = true;
  }

  galleryModal.hidden = false;
  document.body.classList.add("gallery-open");
  const closeBtn = galleryModal.querySelector(".niche-modal-close");
  if (closeBtn) closeBtn.focus();
}

function setupGalleryDrag(key) {
  if (!galleryBody) return;
  let dragIndex = null;

  galleryBody.querySelectorAll(".niche-gallery-item").forEach((figure) => {
    figure.addEventListener("dragstart", (e) => {
      dragIndex = Number(figure.dataset.galleryIndex);
      figure.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(dragIndex));
    });
    figure.addEventListener("dragend", () => {
      figure.classList.remove("is-dragging");
      dragIndex = null;
    });
    figure.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });
    figure.addEventListener("drop", (e) => {
      e.preventDefault();
      const from = dragIndex ?? Number(e.dataTransfer.getData("text/plain"));
      const to = Number(figure.dataset.galleryIndex);
      if (Number.isNaN(from) || Number.isNaN(to) || from === to) return;
      reorderGalleryItem(key, from, to);
    });
  });
}

function saveGalleries() {
  writeJson(STORE.galleries, nicheGalleries);
}

function removeGalleryItem(key, index) {
  const data = nicheGalleries[key];
  if (!data || !data.items[index]) return;
  const [removed] = data.items.splice(index, 1);
  if (removed?.blobId) {
    // keep blob if still referenced elsewhere; only delete if unused
    const stillUsed =
      Object.values(nicheGalleries).some((g) => g.items.some((it) => it.blobId === removed.blobId)) ||
      getCustomMedia().some((m) => m.blobId === removed.blobId);
    if (!stillUsed) idbDeleteBlob(removed.blobId).catch(() => {});
  }
  saveGalleries();
  openGallery(key, lastFocus);
}

function reorderGalleryItem(key, from, to) {
  const data = nicheGalleries[key];
  if (!data) return;
  const [item] = data.items.splice(from, 1);
  data.items.splice(to, 0, item);
  saveGalleries();
  openGallery(key, lastFocus);
}

function pickGalleryFile(key) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*";
  input.hidden = true;
  document.body.appendChild(input);
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    await addGalleryFile(key, file);
  });
  input.click();
}

async function addGalleryFile(key, file) {
  const data = nicheGalleries[key];
  if (!data) return;
  const blobId = `gal-${key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await idbPutBlob(blobId, file);
  const isVideo = file.type.startsWith("video/");
  data.items.push({
    type: isVideo ? "video" : "image",
    blobId,
    alt: file.name.replace(/\.[^.]+$/, "") || "Novo item",
    mime: file.type,
  });
  saveGalleries();
  openGallery(key, lastFocus);
}

document.querySelectorAll(".style-card[data-gallery]").forEach((card) => {
  card.addEventListener("click", (event) => {
    if (event.target.closest(".media-replace-btn, .media-hide-btn")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (document.body.classList.contains("edit-mode")) {
      if (event.target.closest(".admin-add-btn")) return;
      const onHint = event.target.closest(".style-card-hint");
      // Títulos/textos editáveis no card: não abre galeria (exceto o hint “Ver exemplos”)
      if (event.target.closest("[data-edit]") && !onHint) return;
      selectMedia(card);
      if (!onHint) return;
    }
    openGallery(card.dataset.gallery, card);
  });
});

document.querySelectorAll(".couple-grid video").forEach((video) => {
  bindSinglePlay(document.querySelector(".couple-grid"), video);
});

const storyVideos = document.querySelectorAll("#story-videos video");
storyVideos.forEach((video) => {
  bindSinglePlay(document.getElementById("story-videos"), video);
});

if (galleryModal) {
  galleryModal.querySelectorAll("[data-close-gallery]").forEach((el) => {
    el.addEventListener("click", closeGallery);
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeGallery();
    closeAuthModal();
    closeHelpModal();
    closeHiddenModal();
    closePublishModal();
    clearMediaSelection();
    clearTextSelection();
  }
});

/* ========== Admin CMS ========== */

const STORE = {
  hash: "ramile_kit_pw_hash",
  hidden: "ramile_kit_hidden",
  labels: "ramile_kit_labels",
  text: "ramile_kit_text",
  sizes: "ramile_kit_sizes",
  order: "ramile_kit_order",
  custom: "ramile_kit_custom",
  galleries: "ramile_kit_galleries",
  images: "ramile_kit_images",
  boxes: "ramile_kit_boxes",
  tip: "ramile_kit_seen_tip",
  session: "ramile_kit_edit",
  publish: "ramile_kit_publish",
};

const IDB_NAME = "ramile_kit_blobs";
const IDB_STORE = "files";
const DEFAULT_HINT = "ramile2026";
/** Prefill for Configurar publicação (matches this GitHub Pages repo) */
const PUBLISH_DEFAULTS = {
  username: "ramileesteves-png",
  repo: "ramile-ugc",
  branch: "main",
};
const SIZE_STEPS = ["p", "m", "g"];
const SIZE_LABELS = { p: "P", m: "M", g: "G" };
const BOX_W_MIN = 12;
const BOX_W_MAX = 96;
const BOX_H_MIN = 0;
const BOX_H_MAX = 48;
const BOX_STEP = 1;
const BOX_XY_MIN = -40;
const BOX_XY_MAX = 40;
const BOX_ALIGNS = new Set(["left", "center", "right"]);
/** One-time clear of overly-narrow maxWidthRem from older edits */
const BOXES_LAYOUT_MIGRATE = "ramile_kit_boxes_wide_v1";
const BOX_NARROW_REM = 40;
/** Max bytes to embed as data URL in published.json (images only) */
const PUBLISH_MAX_EMBED_BYTES = 1.5 * 1024 * 1024;
const PUBLISH_MAX_JSON_CHARS = 8 * 1024 * 1024;


let idbPromise = null;
let selectedMediaEl = null;
let activeTextEl = null;
let layoutToolsBound = false;
let textToolsBound = false;
let dragBound = false;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function idbOpen() {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return idbPromise;
}

async function idbPutBlob(id, blob) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetBlob(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDeleteBlob(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getHidden() {
  return readJson(STORE.hidden, []);
}

function getLabels() {
  return readJson(STORE.labels, {});
}

function getTextMap() {
  return readJson(STORE.text, {});
}

function getSizesMap() {
  return readJson(STORE.sizes, {});
}

function getOrderMap() {
  return readJson(STORE.order, {});
}

function getCustomMedia() {
  return readJson(STORE.custom, []);
}

function getImagesMap() {
  return readJson(STORE.images, {});
}

function getBoxesMap() {
  return readJson(STORE.boxes, {});
}

function normalizeSize(value) {
  const v = String(value || "m").toLowerCase();
  return SIZE_STEPS.includes(v) ? v : "m";
}

function loadGalleriesFromStorage() {
  const saved = readJson(STORE.galleries, null);
  if (saved && typeof saved === "object") {
    nicheGalleries = cloneGalleries(DEFAULT_GALLERIES);
    Object.keys(DEFAULT_GALLERIES).forEach((key) => {
      if (saved[key] && Array.isArray(saved[key].items)) {
        nicheGalleries[key] = {
          title: saved[key].title || DEFAULT_GALLERIES[key].title,
          items: saved[key].items,
        };
      }
    });
  } else {
    nicheGalleries = cloneGalleries(DEFAULT_GALLERIES);
  }
}

function refreshHideStyle() {
  const hidden = getHidden();
  let style = document.getElementById("ramile-kit-hide");
  if (!style) {
    style = document.createElement("style");
    style.id = "ramile-kit-hide";
    document.documentElement.appendChild(style);
  }
  style.textContent = hidden
    .map((id) => `[data-media-id="${String(id).replace(/"/g, "")}"]{display:none!important}`)
    .join("");
}

function applyTextOverrides() {
  const text = getTextMap();
  Object.keys(text).forEach((id) => {
    const el = document.querySelector(`[data-edit="${CSS.escape(id)}"]`);
    if (!el) return;
    el.innerHTML = text[id];
    el.querySelectorAll(".text-box-handle, .text-box-move").forEach((n) => n.remove());
  });
}

function applySizeToElement(el, size) {
  if (!el) return;
  const normalized = normalizeSize(size);
  if (normalized === "m") el.removeAttribute("data-kit-size");
  else el.setAttribute("data-kit-size", normalized);
}

function applySizes() {
  const sizes = getSizesMap();
  document.querySelectorAll("[data-media-id]").forEach((el) => {
    const id = el.getAttribute("data-media-id");
    applySizeToElement(el, sizes[id] || "m");
  });
}

function applyOrder() {
  const order = getOrderMap();
  Object.keys(order).forEach((key) => {
    const ids = order[key];
    if (!Array.isArray(ids) || !ids.length) return;
    const container = document.querySelector(`[data-order-key="${CSS.escape(key)}"]`);
    if (!container) return;
    ids.forEach((id) => {
      const child = container.querySelector(`:scope > [data-media-id="${CSS.escape(String(id))}"]`);
      if (child) container.appendChild(child);
    });
  });
}

function saveSize(id, size) {
  if (!id) return;
  const map = getSizesMap();
  const normalized = normalizeSize(size);
  if (normalized === "m") delete map[id];
  else map[id] = normalized;
  writeJson(STORE.sizes, map);
}

function saveContainerOrder(container) {
  if (!container) return;
  const key = container.getAttribute("data-order-key");
  if (!key) return;
  const ids = Array.from(container.querySelectorAll(":scope > [data-media-id]")).map((el) =>
    el.getAttribute("data-media-id")
  );
  const map = getOrderMap();
  map[key] = ids;
  writeJson(STORE.order, map);
}

function isUnlocked() {
  return sessionStorage.getItem(STORE.session) === "1";
}

function setUnlocked(on) {
  if (on) sessionStorage.setItem(STORE.session, "1");
  else sessionStorage.removeItem(STORE.session);
}

const adminBar = document.getElementById("admin-bar");
const layoutToolbar = document.getElementById("admin-layout-toolbar");
const layoutSizeLabel = document.getElementById("admin-layout-size-label");
const layoutReplaceBtn = layoutToolbar?.querySelector("[data-layout-replace]");
const textToolbar = document.getElementById("admin-text-toolbar");
const textWLabel = document.getElementById("admin-text-w-label");
const textHLabel = document.getElementById("admin-text-h-label");
const authModal = document.getElementById("admin-auth-modal");
const helpModal = document.getElementById("admin-help-modal");
const hiddenModal = document.getElementById("admin-hidden-modal");
const publishModal = document.getElementById("admin-publish-modal");
const authForm = document.getElementById("admin-auth-form");
const authTitle = document.getElementById("admin-auth-title");
const authLead = document.getElementById("admin-auth-lead");
const authError = document.getElementById("admin-auth-error");
const authSubmit = document.getElementById("admin-auth-submit");
const pwInput = document.getElementById("admin-pw");
const pw2Input = document.getElementById("admin-pw2");
const pw2Wrap = document.getElementById("admin-pw2-wrap");
const pwLabel = document.getElementById("admin-pw-label");
const publishForm = document.getElementById("admin-publish-form");
const publishUsername = document.getElementById("publish-username");
const publishRepo = document.getElementById("publish-repo");
const publishBranch = document.getElementById("publish-branch");
const publishToken = document.getElementById("publish-token");
const publishUrlPreview = document.getElementById("publish-url-preview");
const publishError = document.getElementById("admin-publish-error");
const publishOk = document.getElementById("admin-publish-ok");

let authMode = "login";

function showAuthError(msg) {
  if (!authError) return;
  authError.hidden = !msg;
  authError.textContent = msg || "";
}

function openAuthModal(mode) {
  authMode = mode || (localStorage.getItem(STORE.hash) ? "login" : "setup");
  if (!authModal) return;
  showAuthError("");
  if (pwInput) pwInput.value = "";
  if (pw2Input) pw2Input.value = "";

  if (authMode === "setup") {
    if (authTitle) authTitle.textContent = "Crie sua senha";
    if (authLead)
      authLead.textContent =
        "Primeira vez: escolha uma senha só sua (mín. 4 caracteres). Sugestão se quiser algo simples: " +
        DEFAULT_HINT;
    if (pwLabel) pwLabel.textContent = "Nova senha";
    if (pw2Wrap) pw2Wrap.hidden = false;
    if (authSubmit) authSubmit.textContent = "Salvar e entrar";
  } else if (authMode === "change") {
    if (authTitle) authTitle.textContent = "Alterar senha";
    if (authLead) authLead.textContent = "Digite a nova senha duas vezes.";
    if (pwLabel) pwLabel.textContent = "Nova senha";
    if (pw2Wrap) pw2Wrap.hidden = false;
    if (authSubmit) authSubmit.textContent = "Salvar senha";
  } else {
    if (authTitle) authTitle.textContent = "Área da dona";
    if (authLead) authLead.textContent = "Digite sua senha para editar o site.";
    if (pwLabel) pwLabel.textContent = "Senha";
    if (pw2Wrap) pw2Wrap.hidden = true;
    if (authSubmit) authSubmit.textContent = "Entrar";
  }

  authModal.hidden = false;
  document.body.classList.add("admin-modal-open");
  setTimeout(() => pwInput && pwInput.focus(), 50);
}

function closeAuthModal() {
  if (!authModal || authModal.hidden) return;
  authModal.hidden = true;
  document.body.classList.remove("admin-modal-open");
}

function openHelpModal() {
  if (!helpModal) return;
  helpModal.hidden = false;
  document.body.classList.add("admin-modal-open");
}

function closeHelpModal() {
  if (!helpModal || helpModal.hidden) return;
  helpModal.hidden = true;
  if (authModal?.hidden && hiddenModal?.hidden && publishModal?.hidden) {
    document.body.classList.remove("admin-modal-open");
  }
}

function openHiddenModal() {
  renderHiddenList();
  if (!hiddenModal) return;
  hiddenModal.hidden = false;
  document.body.classList.add("admin-modal-open");
}

function closeHiddenModal() {
  if (!hiddenModal || hiddenModal.hidden) return;
  hiddenModal.hidden = true;
  if (authModal?.hidden && helpModal?.hidden && publishModal?.hidden) {
    document.body.classList.remove("admin-modal-open");
  }
}

function getPublishConfig() {
  return readJson(STORE.publish, null);
}

/** Normalize pasted GitHub user/repo (URLs, @user, owner/repo, .git). */
function normalizePublishIdentity(username, repo) {
  let user = String(username || "").trim().replace(/^@/, "");
  let name = String(repo || "").trim();

  const fromUrl = (raw) => {
    const m = String(raw || "").match(
      /github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i
    );
    if (!m) return null;
    return { user: m[1], repo: m[2].replace(/\.git$/i, "") };
  };

  const parsedUser = fromUrl(user);
  if (parsedUser) {
    user = parsedUser.user;
    if (!name) name = parsedUser.repo;
  }
  const parsedRepo = fromUrl(name);
  if (parsedRepo) {
    if (!user) user = parsedRepo.user;
    name = parsedRepo.repo;
  }

  if (name.includes("/")) {
    const parts = name.split("/").filter(Boolean);
    if (parts.length >= 2) {
      if (!user) user = parts[parts.length - 2];
      name = parts[parts.length - 1];
    }
  }
  name = name.replace(/\.git$/i, "");

  return { username: user, repo: name };
}

function publicSiteUrl(cfg) {
  if (!cfg?.username || !cfg?.repo) return "";
  return `https://${cfg.username}.github.io/${cfg.repo}/`;
}

function updatePublishUrlPreview() {
  if (!publishUrlPreview) return;
  const { username: user, repo } = normalizePublishIdentity(
    publishUsername?.value,
    publishRepo?.value
  );
  if (!user || !repo) {
    publishUrlPreview.hidden = true;
    publishUrlPreview.textContent = "";
    return;
  }
  publishUrlPreview.hidden = false;
  publishUrlPreview.innerHTML = `URL pública: <a href="https://${user}.github.io/${repo}/" target="_blank" rel="noopener">https://${user}.github.io/${repo}/</a>`;
}

function githubApiErrorMessage(status, errText, phase) {
  const snippet = (errText || "").replace(/\s+/g, " ").trim().slice(0, 180);
  const where =
    phase === "read"
      ? "ao ler data/published.json"
      : "ao gravar data/published.json";
  if (status === 401) {
    return (
      `Token inválido ou expirado (${status} ${where}). Gere um novo PAT classic com escopo repo e cole de novo em Configurar. ${snippet}`
    );
  }
  if (status === 403) {
    return (
      `Sem permissão de escrita (${status} ${where}). Use PAT classic com escopo repo, ou fine-grained com Contents: Read and write neste repositório. ${snippet}`
    );
  }
  if (status === 404) {
    return (
      `Não encontrado (${status} ${where}). Confira usuário e repositório (ex.: ${PUBLISH_DEFAULTS.username} / ${PUBLISH_DEFAULTS.repo}). ` +
      `Se estiverem corretos, o GitHub costuma devolver 404 quando o token está errado ou sem permissão — gere um PAT com repo e salve de novo. ${snippet}`
    );
  }
  if (status === 409 || status === 422) {
    return (
      `Conflito ao atualizar o arquivo (${status}). Tente Publicar de novo; se continuar, confira a branch (main). ${snippet}`
    );
  }
  return `Falha ao publicar (${status} ${where}). ${snippet}`;
}

function showPublishError(msg) {
  if (publishError) {
    publishError.hidden = !msg;
    publishError.textContent = msg || "";
  }
  if (publishOk && msg) publishOk.hidden = true;
}

function showPublishOk(msg) {
  if (publishOk) {
    publishOk.hidden = !msg;
    publishOk.textContent = msg || "";
  }
  if (publishError && msg) publishError.hidden = true;
}

function openPublishModal() {
  if (!document.body.classList.contains("edit-mode") || !isUnlocked()) return;
  if (!publishModal) return;
  const cfg = getPublishConfig() || {};
  if (publishUsername) {
    publishUsername.value = cfg.username || PUBLISH_DEFAULTS.username;
  }
  if (publishRepo) publishRepo.value = cfg.repo || PUBLISH_DEFAULTS.repo;
  if (publishBranch) {
    publishBranch.value = cfg.branch || PUBLISH_DEFAULTS.branch;
  }
  if (publishToken) publishToken.value = cfg.token || "";
  showPublishError("");
  showPublishOk("");
  updatePublishUrlPreview();
  publishModal.hidden = false;
  document.body.classList.add("admin-modal-open");
  setTimeout(() => {
    if (publishToken && !publishToken.value) publishToken.focus();
    else if (publishUsername) publishUsername.focus();
  }, 50);
}

function closePublishModal() {
  if (!publishModal || publishModal.hidden) return;
  publishModal.hidden = true;
  if (authModal?.hidden && helpModal?.hidden && hiddenModal?.hidden) {
    document.body.classList.remove("admin-modal-open");
  }
}

document.querySelectorAll("[data-close-auth]").forEach((el) => {
  el.addEventListener("click", closeAuthModal);
});
document.querySelectorAll("[data-close-help]").forEach((el) => {
  el.addEventListener("click", () => {
    localStorage.setItem(STORE.tip, "1");
    closeHelpModal();
  });
});
document.querySelectorAll("[data-close-hidden]").forEach((el) => {
  el.addEventListener("click", closeHiddenModal);
});
document.querySelectorAll("[data-close-publish]").forEach((el) => {
  el.addEventListener("click", closePublishModal);
});
[publishUsername, publishRepo].forEach((el) => {
  if (el) el.addEventListener("input", updatePublishUrlPreview);
});

function clearMediaSelection() {
  if (selectedMediaEl) selectedMediaEl.classList.remove("is-selected");
  selectedMediaEl = null;
  if (layoutToolbar) layoutToolbar.hidden = true;
  if (layoutReplaceBtn) layoutReplaceBtn.hidden = true;
}

function mediaHasReplaceableImage(el) {
  if (!el) return false;
  if (el.getAttribute("data-replaceable") === "image") return true;
  const img = el.querySelector(":scope > img, img");
  if (!img) return false;
  if (el.querySelector(":scope > video, :scope > iframe, .instagram-media")) return false;
  return true;
}

function selectMedia(el) {
  if (!el || !document.body.classList.contains("edit-mode")) return;
  clearTextSelection();
  if (selectedMediaEl) selectedMediaEl.classList.remove("is-selected");
  selectedMediaEl = el;
  el.classList.add("is-selected");
  const id = el.getAttribute("data-media-id");
  const size = normalizeSize(getSizesMap()[id] || el.getAttribute("data-kit-size") || "m");
  if (layoutSizeLabel) layoutSizeLabel.textContent = SIZE_LABELS[size];
  if (layoutToolbar) layoutToolbar.hidden = false;
  if (layoutReplaceBtn) layoutReplaceBtn.hidden = !mediaHasReplaceableImage(el);
}

function bumpSelectedSize(dir) {
  if (!selectedMediaEl) return;
  const id = selectedMediaEl.getAttribute("data-media-id");
  if (!id) return;
  const current = normalizeSize(getSizesMap()[id] || selectedMediaEl.getAttribute("data-kit-size") || "m");
  const idx = SIZE_STEPS.indexOf(current);
  const next = SIZE_STEPS[Math.max(0, Math.min(SIZE_STEPS.length - 1, idx + dir))];
  applySizeToElement(selectedMediaEl, next);
  saveSize(id, next);
  if (layoutSizeLabel) layoutSizeLabel.textContent = SIZE_LABELS[next];
}

function setupLayoutTools() {
  if (layoutToolsBound) return;
  layoutToolsBound = true;

  if (layoutToolbar) {
    layoutToolbar.addEventListener("click", (e) => {
      const replace = e.target.closest("[data-layout-replace]");
      if (replace) {
        e.preventDefault();
        if (selectedMediaEl) pickReplaceImage(selectedMediaEl);
        return;
      }
      const btn = e.target.closest("[data-layout-size]");
      if (!btn) return;
      const action = btn.getAttribute("data-layout-size");
      if (action === "-") bumpSelectedSize(-1);
      if (action === "+") bumpSelectedSize(1);
    });
  }

  document.addEventListener("click", (e) => {
    if (!document.body.classList.contains("edit-mode")) return;
    if (
      e.target.closest(
        "#admin-layout-toolbar, #admin-text-toolbar, #admin-bar, .admin-modal, .niche-modal, .admin-add-btn, .media-hide-btn, .media-replace-btn, [data-edit]"
      )
    ) {
      return;
    }
    const media = e.target.closest("[data-media-id]");
    if (media) {
      selectMedia(media);
      return;
    }
    clearMediaSelection();
  });
}

function setupDragReorder() {
  if (dragBound) return;
  dragBound = true;
  let dragEl = null;

  document.addEventListener("dragstart", (e) => {
    if (!document.body.classList.contains("edit-mode")) return;
    if (e.target.closest(".niche-gallery-item")) return;
    const el = e.target.closest("[data-order-key] > [data-media-id]");
    if (!el) return;
    if (e.target.closest("[data-edit], .media-hide-btn, .media-replace-btn, video, iframe, a, input, button:not(.style-card)")) {
      e.preventDefault();
      return;
    }
    dragEl = el;
    el.classList.add("is-dragging");
    selectMedia(el);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", el.getAttribute("data-media-id") || "");
  });

  document.addEventListener("dragend", () => {
    if (dragEl) dragEl.classList.remove("is-dragging");
    dragEl = null;
    document.querySelectorAll(".drag-over").forEach((n) => n.classList.remove("drag-over"));
  });

  document.addEventListener("dragover", (e) => {
    if (!document.body.classList.contains("edit-mode") || !dragEl) return;
    const target = e.target.closest("[data-order-key] > [data-media-id]");
    if (!target || target === dragEl) return;
    if (target.parentElement !== dragEl.parentElement) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    document.querySelectorAll(".drag-over").forEach((n) => n.classList.remove("drag-over"));
    target.classList.add("drag-over");
  });

  document.addEventListener("drop", (e) => {
    if (!document.body.classList.contains("edit-mode") || !dragEl) return;
    const target = e.target.closest("[data-order-key] > [data-media-id]");
    if (!target || target === dragEl) return;
    if (target.parentElement !== dragEl.parentElement) return;
    e.preventDefault();
    const container = dragEl.parentElement;
    const kids = Array.from(container.querySelectorAll(":scope > [data-media-id]"));
    const from = kids.indexOf(dragEl);
    const to = kids.indexOf(target);
    if (from < 0 || to < 0) return;
    if (from < to) container.insertBefore(dragEl, target.nextSibling);
    else container.insertBefore(dragEl, target);
    saveContainerOrder(container);
    target.classList.remove("drag-over");
  });
}

function setDraggableState(on) {
  document.querySelectorAll("[data-order-key] > [data-media-id]").forEach((el) => {
    el.draggable = !!on;
  });
}

function mediaLabel(el) {
  return (
    el.getAttribute("data-media-label") ||
    el.querySelector("figcaption")?.textContent?.trim() ||
    el.getAttribute("data-media-id") ||
    "Item"
  );
}

function setupHideButtons() {
  document.querySelectorAll("[data-media-id]").forEach((el) => {
    el.classList.add("media-editable");

    if (mediaHasReplaceableImage(el) && !el.querySelector(".media-replace-btn")) {
      // span (não <button>) — .style-card já é <button>; botão aninhado quebra o clique
      const swap = document.createElement("span");
      swap.className = "media-replace-btn";
      swap.setAttribute("role", "button");
      swap.setAttribute("tabindex", "0");
      swap.setAttribute("aria-label", "Trocar foto");
      swap.title = "Trocar foto";
      swap.textContent = "Trocar foto";
      const openPicker = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectMedia(el);
        pickReplaceImage(el);
      };
      swap.addEventListener("click", openPicker);
      swap.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") openPicker(e);
      });
      el.appendChild(swap);
    }

    if (el.hasAttribute("data-media-fixed")) return;
    if (el.querySelector(".media-hide-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "media-hide-btn";
    btn.setAttribute("aria-label", "Ocultar este item");
    btn.title = "Ocultar / tirar da página";
    btn.textContent = "×";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideMedia(el.getAttribute("data-media-id"), mediaLabel(el));
    });
    el.appendChild(btn);
  });
}

function pickReplaceImage(el) {
  const id = el?.getAttribute("data-media-id");
  if (!id) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.hidden = true;
  document.body.appendChild(input);
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Escolha um arquivo de imagem (jpg, png, webp…).");
      return;
    }
    try {
      await replaceMediaImage(el, file);
    } catch (err) {
      console.error(err);
      alert("Não foi possível trocar esta foto. Tente outro arquivo.");
    }
  });
  input.click();
}

async function replaceMediaImage(el, file) {
  const id = el.getAttribute("data-media-id");
  if (!id) return;
  const blobId = `img-${id}`;
  const map = getImagesMap();
  const prev = map[id]?.blobId;
  if (objectUrlCache.has(blobId)) {
    URL.revokeObjectURL(objectUrlCache.get(blobId));
    objectUrlCache.delete(blobId);
  }
  await idbPutBlob(blobId, file);
  map[id] = { blobId, updatedAt: new Date().toISOString() };
  writeJson(STORE.images, map);
  if (prev && prev !== blobId) {
    const stillUsed =
      Object.values(getImagesMap()).some((v) => v?.blobId === prev) ||
      getCustomMedia().some((m) => m.blobId === prev) ||
      Object.values(nicheGalleries).some((g) => g.items.some((it) => it.blobId === prev));
    if (!stillUsed) {
      if (objectUrlCache.has(prev)) {
        URL.revokeObjectURL(objectUrlCache.get(prev));
        objectUrlCache.delete(prev);
      }
      idbDeleteBlob(prev).catch(() => {});
    }
  }
  const url = await resolveMediaSrc({ blobId });
  const img = el.querySelector("img");
  if (img && url) img.src = url;
}

async function applyImageOverrides() {
  const map = getImagesMap();
  const ids = Object.keys(map);
  for (const id of ids) {
    const entry = map[id];
    if (!entry?.blobId) continue;
    const el = document.querySelector(`[data-media-id="${CSS.escape(id)}"]`);
    if (!el) continue;
    const img = el.querySelector("img");
    if (!img) continue;
    const url = await resolveMediaSrc(entry);
    if (url) img.src = url;
  }
}

function hideMedia(id, label) {
  if (!id) return;
  const hidden = getHidden();
  if (!hidden.includes(id)) hidden.push(id);
  writeJson(STORE.hidden, hidden);
  const labels = getLabels();
  labels[id] = label;
  writeJson(STORE.labels, labels);
  refreshHideStyle();
  if (selectedMediaEl?.getAttribute("data-media-id") === id) clearMediaSelection();
}

function restoreMedia(id) {
  const hidden = getHidden().filter((x) => x !== id);
  writeJson(STORE.hidden, hidden);
  const labels = getLabels();
  delete labels[id];
  writeJson(STORE.labels, labels);
  refreshHideStyle();
  renderHiddenList();
}

function renderHiddenList() {
  const list = document.getElementById("admin-hidden-list");
  const empty = document.getElementById("admin-hidden-empty");
  if (!list) return;
  const hidden = getHidden();
  const labels = getLabels();
  list.innerHTML = "";
  if (empty) empty.hidden = hidden.length > 0;

  hidden.forEach((id) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = labels[id] || id;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn ghost";
    btn.textContent = "Restaurar";
    btn.addEventListener("click", () => restoreMedia(id));
    li.append(name, btn);
    list.appendChild(li);
  });
}

function clearTextSelection() {
  if (activeTextEl) {
    activeTextEl.classList.remove("is-text-selected");
    activeTextEl = null;
  }
  if (textToolbar) textToolbar.hidden = true;
}

function rootFontPx() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

function clampNum(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function readBoxState(el) {
  const id = el?.getAttribute("data-edit");
  const saved = id ? getBoxesMap()[id] || {} : {};
  const cs = getComputedStyle(el);
  const root = rootFontPx();
  let maxWidthRem = saved.maxWidthRem;
  let minHeightRem = saved.minHeightRem;
  let align = saved.align;
  let xRem = saved.xRem;
  let yRem = saved.yRem;

  if (maxWidthRem == null) {
    const mw = cs.maxWidth;
    if (mw && mw !== "none") {
      const parsed = parseFloat(mw);
      if (!Number.isNaN(parsed)) maxWidthRem = round1(parsed / root);
    }
  }
  if (minHeightRem == null) {
    const mh = parseFloat(cs.minHeight);
    if (mh && mh > 0) minHeightRem = round1(mh / root);
  }
  if (!BOX_ALIGNS.has(align)) {
    const ta = cs.textAlign;
    if (ta === "center" || ta === "right") align = ta;
    else align = "left";
  }
  if (xRem == null || Number.isNaN(Number(xRem))) xRem = 0;
  if (yRem == null || Number.isNaN(Number(yRem))) yRem = 0;

  return {
    align,
    maxWidthRem: maxWidthRem == null || Number.isNaN(maxWidthRem) ? null : maxWidthRem,
    minHeightRem: minHeightRem == null || Number.isNaN(minHeightRem) ? null : minHeightRem,
    xRem: Number(xRem) || 0,
    yRem: Number(yRem) || 0,
  };
}

function sanitizeBox(box) {
  if (!box || typeof box !== "object") return {};
  const next = {};
  if (BOX_ALIGNS.has(box.align)) next.align = box.align;
  if (box.maxWidthRem != null && !Number.isNaN(Number(box.maxWidthRem))) {
    next.maxWidthRem = clampNum(Number(box.maxWidthRem), BOX_W_MIN, BOX_W_MAX);
  }
  if (box.minHeightRem != null && Number(box.minHeightRem) > 0) {
    next.minHeightRem = clampNum(Number(box.minHeightRem), 0.5, BOX_H_MAX);
  }
  const x = Number(box.xRem);
  const y = Number(box.yRem);
  if (!Number.isNaN(x) && x !== 0) next.xRem = clampNum(round1(x), BOX_XY_MIN, BOX_XY_MAX);
  if (!Number.isNaN(y) && y !== 0) next.yRem = clampNum(round1(y), BOX_XY_MIN, BOX_XY_MAX);
  return next;
}

/** Drop legacy skinny box widths so CSS layout can fill the screen */
function migrateNarrowBoxWidths() {
  if (localStorage.getItem(BOXES_LAYOUT_MIGRATE) === "1") return;
  const map = getBoxesMap();
  let changed = false;
  Object.keys(map).forEach((id) => {
    const box = map[id];
    if (!box || typeof box !== "object") return;
    const w = Number(box.maxWidthRem);
    if (!Number.isNaN(w) && w > 0 && w < BOX_NARROW_REM) {
      delete box.maxWidthRem;
      changed = true;
    }
    const clean = sanitizeBox(box);
    if (Object.keys(clean).length) map[id] = clean;
    else {
      delete map[id];
      changed = true;
    }
  });
  if (changed) writeJson(STORE.boxes, map);
  localStorage.setItem(BOXES_LAYOUT_MIGRATE, "1");
}

function isLayoutLockedEdit(el) {
  return Boolean(el?.closest(".section-head") || el?.matches?.(".section-lead, .subhead"));
}

function applyBoxToElement(el, box) {
  if (!el) return;
  const clean = sanitizeBox(box);
  const align = clean.align || "";
  const xRem = clean.xRem || 0;
  const yRem = clean.yRem || 0;
  const layoutLocked = isLayoutLockedEdit(el);

  /* Empty align → inherit CSS (section-head defaults to center) */
  el.style.textAlign = align || "";
  el.dataset.textAlign = align || "inherit";

  if (!layoutLocked && clean.maxWidthRem != null) {
    el.style.maxWidth = `${clean.maxWidthRem}rem`;
    el.style.width = "100%";
  } else {
    el.style.maxWidth = "";
    el.style.width = "";
  }

  if (clean.minHeightRem != null) {
    el.style.minHeight = `${clean.minHeightRem}rem`;
  } else {
    el.style.minHeight = "";
  }

  /* Margem horizontal só quando não há arraste lateral — senão left/top mandam */
  if (xRem === 0) {
    if (align === "center" || (!align && layoutLocked)) {
      el.style.marginLeft = "auto";
      el.style.marginRight = "auto";
    } else if (align === "right") {
      el.style.marginLeft = "auto";
      el.style.marginRight = "0";
    } else {
      el.style.marginLeft = "";
      el.style.marginRight = "";
    }
  } else {
    el.style.marginLeft = "";
    el.style.marginRight = "";
  }

  if (xRem !== 0 || yRem !== 0) {
    el.style.position = "relative";
    el.style.left = xRem ? `${xRem}rem` : "";
    el.style.top = yRem ? `${yRem}rem` : "";
    el.dataset.boxMoved = "1";
  } else {
    el.style.left = "";
    el.style.top = "";
    delete el.dataset.boxMoved;
    if (!document.body.classList.contains("edit-mode")) {
      el.style.position = "";
    }
  }

  el.classList.toggle("is-align-center", align === "center");
  el.classList.toggle("is-align-right", align === "right");
  el.classList.toggle("is-align-left", align === "left");
  refreshAlignButtons(align, el);
}

function saveBoxState(el, box) {
  const id = el?.getAttribute("data-edit");
  if (!id) return;
  const map = getBoxesMap();
  const next = sanitizeBox(box);
  if (Object.keys(next).length) map[id] = next;
  else delete map[id];
  writeJson(STORE.boxes, map);
}

function refreshAlignButtons(align, el) {
  if (!textToolbar) return;
  const effective =
    align ||
    (el && isLayoutLockedEdit(el) ? "center" : "left");
  textToolbar.querySelectorAll(".admin-align-btn").forEach((btn) => {
    const action = btn.getAttribute("data-text-box") || "";
    const isOn =
      (action === "align-left" && effective === "left") ||
      (action === "align-center" && effective === "center") ||
      (action === "align-right" && effective === "right");
    btn.classList.toggle("is-active", isOn);
    btn.setAttribute("aria-pressed", String(isOn));
  });
}

function refreshTextToolbarLabels(el) {
  const box = readBoxState(el);
  if (textWLabel) textWLabel.textContent = box.maxWidthRem != null ? `${box.maxWidthRem}` : "auto";
  if (textHLabel) textHLabel.textContent = box.minHeightRem != null && box.minHeightRem > 0 ? `${box.minHeightRem}` : "auto";
  refreshAlignButtons(box.align || "", el);
}

function selectTextBox(el) {
  if (!el || !document.body.classList.contains("edit-mode")) return;
  clearMediaSelection();
  if (activeTextEl && activeTextEl !== el) activeTextEl.classList.remove("is-text-selected");
  activeTextEl = el;
  el.classList.add("is-text-selected");
  refreshTextToolbarLabels(el);
  if (textToolbar) textToolbar.hidden = false;
}

function bumpTextBox(axis, dir) {
  if (!activeTextEl) return;
  const box = readBoxState(activeTextEl);
  if (axis === "w") {
    const base =
      box.maxWidthRem != null
        ? box.maxWidthRem
        : round1(activeTextEl.getBoundingClientRect().width / rootFontPx());
    box.maxWidthRem = clampNum(round1(base + dir * BOX_STEP), BOX_W_MIN, BOX_W_MAX);
  } else if (axis === "h") {
    const base = box.minHeightRem != null ? box.minHeightRem : 0;
    const next = clampNum(round1(base + dir * BOX_STEP), BOX_H_MIN, BOX_H_MAX);
    box.minHeightRem = next > 0 ? next : null;
  }
  applyBoxToElement(activeTextEl, box);
  saveBoxState(activeTextEl, box);
  refreshTextToolbarLabels(activeTextEl);
}

function setTextAlign(align) {
  if (!activeTextEl || !BOX_ALIGNS.has(align)) return;
  const box = readBoxState(activeTextEl);
  box.align = align;
  applyBoxToElement(activeTextEl, box);
  saveBoxState(activeTextEl, box);
  refreshTextToolbarLabels(activeTextEl);
}

function resetTextBox() {
  if (!activeTextEl) return;
  applyBoxToElement(activeTextEl, {});
  saveBoxState(activeTextEl, {});
  refreshTextToolbarLabels(activeTextEl);
}

function applyBoxes() {
  const boxes = getBoxesMap();
  Object.keys(boxes).forEach((id) => {
    const el = document.querySelector(`[data-edit="${CSS.escape(id)}"]`);
    if (el) applyBoxToElement(el, boxes[id]);
  });
}

function ensureTextBoxHandles(el) {
  if (!el.querySelector(":scope > .text-box-move")) {
    const move = document.createElement("span");
    move.className = "text-box-move";
    move.contentEditable = "false";
    move.title = "Arraste para mover a caixa";
    move.setAttribute("aria-hidden", "true");
    move.textContent = "◇";
    el.appendChild(move);
  }
  if (!el.querySelector(":scope > .text-box-handle")) {
    const handle = document.createElement("span");
    handle.className = "text-box-handle";
    handle.contentEditable = "false";
    handle.title = "Arraste para redimensionar a caixa";
    handle.setAttribute("aria-hidden", "true");
    el.appendChild(handle);
  }
}

function stripTextBoxChrome(clone) {
  clone.querySelectorAll(".text-box-handle, .text-box-move").forEach((n) => n.remove());
}

function setupTextBoxTools() {
  if (textToolsBound) return;
  textToolsBound = true;

  if (textToolbar) {
    textToolbar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-text-box]");
      if (!btn) return;
      const action = btn.getAttribute("data-text-box");
      if (action === "w-") bumpTextBox("w", -1);
      if (action === "w+") bumpTextBox("w", 1);
      if (action === "h-") bumpTextBox("h", -1);
      if (action === "h+") bumpTextBox("h", 1);
      if (action === "align-left") setTextAlign("left");
      if (action === "align-center") setTextAlign("center");
      if (action === "align-right") setTextAlign("right");
      if (action === "reset") resetTextBox();
    });
  }

  document.addEventListener("pointerdown", (e) => {
    if (!document.body.classList.contains("edit-mode")) return;

    const moveHandle = e.target.closest(".text-box-move");
    const resizeHandle = e.target.closest(".text-box-handle");
    if (!moveHandle && !resizeHandle) return;

    e.preventDefault();
    e.stopPropagation();
    const el = (moveHandle || resizeHandle).closest("[data-edit]");
    if (!el) return;
    selectTextBox(el);

    const root = rootFontPx();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = readBoxState(el);
    const pointerId = e.pointerId;
    const handleEl = moveHandle || resizeHandle;
    handleEl.setPointerCapture?.(pointerId);

    if (moveHandle) {
      const startOffX = start.xRem || 0;
      const startOffY = start.yRem || 0;
      const onMove = (ev) => {
        const dx = (ev.clientX - startX) / root;
        const dy = (ev.clientY - startY) / root;
        const box = {
          ...start,
          xRem: clampNum(round1(startOffX + dx), BOX_XY_MIN, BOX_XY_MAX),
          yRem: clampNum(round1(startOffY + dy), BOX_XY_MIN, BOX_XY_MAX),
        };
        applyBoxToElement(el, box);
        el._pendingBox = box;
      };
      const onUp = () => {
        handleEl.releasePointerCapture?.(pointerId);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        if (el._pendingBox) {
          saveBoxState(el, el._pendingBox);
          delete el._pendingBox;
        }
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      return;
    }

    const startW =
      start.maxWidthRem != null
        ? start.maxWidthRem
        : round1(el.getBoundingClientRect().width / root);
    const startH =
      start.minHeightRem != null
        ? start.minHeightRem
        : round1(el.getBoundingClientRect().height / root);

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / root;
      const dy = (ev.clientY - startY) / root;
      const box = {
        ...start,
        maxWidthRem: clampNum(round1(startW + dx), BOX_W_MIN, BOX_W_MAX),
        minHeightRem: clampNum(round1(startH + dy), BOX_H_MIN, BOX_H_MAX),
      };
      if (box.minHeightRem <= 0) box.minHeightRem = null;
      applyBoxToElement(el, box);
      refreshTextToolbarLabels(el);
      el._pendingBox = box;
    };
    const onUp = () => {
      handleEl.releasePointerCapture?.(pointerId);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      if (el._pendingBox) {
        saveBoxState(el, el._pendingBox);
        delete el._pendingBox;
      }
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  });
}

function setupEditableText() {
  document.querySelectorAll("[data-edit]").forEach((el) => {
    el.contentEditable = "true";
    el.spellcheck = true;
    el.classList.add("text-box-editable");
    ensureTextBoxHandles(el);

    if (el.dataset.editBound) return;
    el.dataset.editBound = "1";

    el.addEventListener("focus", () => {
      el.classList.add("is-editing");
      selectTextBox(el);
    });
    el.addEventListener("blur", () => {
      el.classList.remove("is-editing");
      const id = el.getAttribute("data-edit");
      if (!id) return;
      const clone = el.cloneNode(true);
      stripTextBoxChrome(clone);
      const map = getTextMap();
      map[id] = clone.innerHTML;
      writeJson(STORE.text, map);
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && el.tagName !== "P" && el.tagName !== "DIV") {
        e.preventDefault();
        el.blur();
      }
    });
  });
  setupTextBoxTools();
}

function ensureAddButtons() {
  const storyGrid = document.getElementById("story-videos");
  if (storyGrid && !document.getElementById("admin-add-story-wrap")) {
    const wrap = document.createElement("div");
    wrap.id = "admin-add-story-wrap";
    wrap.className = "admin-add-wrap";
    wrap.hidden = true;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn primary admin-add-btn";
    btn.id = "admin-add-story-video";
    btn.textContent = "+ Adicionar vídeo";
    btn.addEventListener("click", () => pickCustomFile("story"));
    const tip = document.createElement("span");
    tip.className = "admin-add-tip";
    tip.textContent = "Escolha um vídeo da sua galeria. Fica salvo neste navegador.";
    wrap.append(btn, tip);
    storyGrid.insertAdjacentElement("beforebegin", wrap);
  }

  const photoGrid = document.querySelector(".photo-grid[data-order-key]");
  if (photoGrid && !document.getElementById("admin-add-photo-wrap")) {
    const wrap = document.createElement("div");
    wrap.id = "admin-add-photo-wrap";
    wrap.className = "admin-add-wrap";
    wrap.hidden = true;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn primary admin-add-btn";
    btn.textContent = "+ Adicionar foto";
    btn.addEventListener("click", () => pickCustomFile("photo"));
    wrap.appendChild(btn);
    photoGrid.insertAdjacentElement("beforebegin", wrap);
  }

  const coupleGrid = document.querySelector(".couple-grid[data-order-key]");
  if (coupleGrid && !document.getElementById("admin-add-couple-wrap")) {
    const wrap = document.createElement("div");
    wrap.id = "admin-add-couple-wrap";
    wrap.className = "admin-add-wrap";
    wrap.hidden = true;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn primary admin-add-btn";
    btn.textContent = "+ Adicionar mídia (nós dois)";
    btn.addEventListener("click", () => pickCustomFile("couple"));
    wrap.appendChild(btn);
    coupleGrid.insertAdjacentElement("beforebegin", wrap);
  }
}

function showAddButtons(on) {
  ensureAddButtons();
  ["admin-add-story-wrap", "admin-add-photo-wrap", "admin-add-couple-wrap"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !on;
  });
}

function pickCustomFile(kind) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = kind === "photo" ? "image/*" : kind === "story" ? "video/*" : "image/*,video/*";
  input.hidden = true;
  document.body.appendChild(input);
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    try {
      await addCustomMedia(kind, file);
    } catch (err) {
      console.error(err);
      alert("Não foi possível adicionar este arquivo. Tente outro formato (mp4, jpg, png).");
    }
  });
  input.click();
}

async function addCustomMedia(kind, file) {
  const id = `custom-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const blobId = id;
  await idbPutBlob(blobId, file);
  const isVideo = file.type.startsWith("video/");
  const captionId = `cap-${id}`;
  const label =
    kind === "story"
      ? "Story · adicionado"
      : kind === "couple"
        ? "Casal · adicionado"
        : "Foto · adicionada";
  const caption =
    file.name.replace(/\.[^.]+$/, "").slice(0, 60) || (isVideo ? "Novo vídeo" : "Nova foto");

  const entry = { id, blobId, kind, type: isVideo ? "video" : "image", captionId, label, caption };
  const list = getCustomMedia();
  list.push(entry);
  writeJson(STORE.custom, list);

  const el = await renderCustomCard(entry);
  if (!el) return;

  let container;
  if (kind === "story") container = document.getElementById("story-videos");
  else if (kind === "couple") container = document.querySelector(".couple-grid");
  else container = document.querySelector(".photo-grid");
  if (container) {
    container.appendChild(el);
    saveContainerOrder(container);
  }

  if (document.body.classList.contains("edit-mode")) {
    setupHideButtons();
    setupEditableText();
    setDraggableState(true);
    selectMedia(el);
  }
}

async function renderCustomCard(entry) {
  if (document.querySelector(`[data-media-id="${CSS.escape(entry.id)}"]`)) {
    return document.querySelector(`[data-media-id="${CSS.escape(entry.id)}"]`);
  }
  const src = await resolveMediaSrc(entry);
  if (!src) return null;

  const figure = document.createElement("figure");
  figure.setAttribute("data-media-id", entry.id);
  figure.setAttribute("data-media-label", entry.label || "Mídia adicionada");
  figure.classList.add("media-custom");

  if (entry.kind === "story") figure.classList.add("story-card");
  if (entry.kind === "couple") figure.classList.add("couple-custom");

  if (entry.type === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = src;
    const root =
      entry.kind === "couple"
        ? document.querySelector(".couple-grid")
        : document.getElementById("story-videos");
    bindSinglePlay(root, video);
    figure.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.src = src;
    img.alt = entry.caption || "";
    figure.appendChild(img);
  }

  const cap = document.createElement("figcaption");
  cap.setAttribute("data-edit", entry.captionId);
  const textMap = getTextMap();
  cap.innerHTML = textMap[entry.captionId] || entry.caption || "";
  figure.appendChild(cap);
  return figure;
}

async function renderAllCustomMedia() {
  const list = getCustomMedia();
  for (const entry of list) {
    const el = await renderCustomCard(entry);
    if (!el || el.parentElement) continue;
    let container;
    if (entry.kind === "story") container = document.getElementById("story-videos");
    else if (entry.kind === "couple") container = document.querySelector(".couple-grid");
    else container = document.querySelector(".photo-grid");
    if (container) container.appendChild(el);
  }
}

async function enableEditMode() {
  setUnlocked(true);
  await applyDraftFromStorage();
  document.body.classList.add("edit-mode");
  if (adminBar) adminBar.hidden = false;
  setupEditableText();
  setupHideButtons();
  setupLayoutTools();
  setupDragReorder();
  setDraggableState(true);
  ensureAddButtons();
  showAddButtons(true);
  closeAuthModal();

  if (!localStorage.getItem(STORE.tip)) {
    openHelpModal();
  }
}

function disableEditMode() {
  setUnlocked(false);
  document.body.classList.remove("edit-mode");
  if (adminBar) adminBar.hidden = true;
  clearMediaSelection();
  clearTextSelection();
  showAddButtons(false);
  setDraggableState(false);
  document.querySelectorAll("[data-edit]").forEach((el) => {
    el.contentEditable = "false";
    el.classList.remove("is-editing", "is-text-selected");
  });
  document.querySelectorAll(".media-hide-btn, .media-replace-btn").forEach((btn) => btn.remove());
  closeHiddenModal();
  closeHelpModal();
  closePublishModal();
  const tools = galleryModal?.querySelector(".niche-admin-tools");
  if (tools) tools.hidden = true;
}

function exportBackup() {
  const payload = {
    version: 3,
    exportedAt: new Date().toISOString(),
    text: getTextMap(),
    boxes: getBoxesMap(),
    hidden: getHidden(),
    labels: getLabels(),
    sizes: getSizesMap(),
    order: getOrderMap(),
    images: getImagesMap(),
    custom: getCustomMedia().map(({ id, kind, type, captionId, label, caption, blobId }) => ({
      id,
      kind,
      type,
      captionId,
      label,
      caption,
      blobId,
    })),
    galleries: nicheGalleries,
    note: "Arquivos de vídeo/foto adicionados ou trocados ficam no IndexedDB deste navegador (não vão no JSON).",
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ramile-kit-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!data || typeof data !== "object") throw new Error("Arquivo inválido");
      if (data.text && typeof data.text === "object") writeJson(STORE.text, data.text);
      if (data.boxes && typeof data.boxes === "object") writeJson(STORE.boxes, data.boxes);
      if (Array.isArray(data.hidden)) writeJson(STORE.hidden, data.hidden);
      if (data.labels && typeof data.labels === "object") writeJson(STORE.labels, data.labels);
      if (data.sizes && typeof data.sizes === "object") writeJson(STORE.sizes, data.sizes);
      if (data.order && typeof data.order === "object") writeJson(STORE.order, data.order);
      if (data.images && typeof data.images === "object") writeJson(STORE.images, data.images);
      if (Array.isArray(data.custom)) writeJson(STORE.custom, data.custom);
      if (data.galleries && typeof data.galleries === "object") writeJson(STORE.galleries, data.galleries);
      location.reload();
    } catch {
      alert("Não foi possível importar este arquivo. Use um JSON exportado daqui.");
    }
  };
  reader.readAsText(file);
}

function resetEdits() {
  if (
    !confirm(
      "Resetar textos, caixas, itens ocultos, tamanhos, ordem, fotos trocadas, mídia adicionada e galerias editadas? A senha permanece. Arquivos deste navegador também serão limpos."
    )
  ) {
    return;
  }
  localStorage.removeItem(STORE.text);
  localStorage.removeItem(STORE.boxes);
  localStorage.removeItem(STORE.hidden);
  localStorage.removeItem(STORE.labels);
  localStorage.removeItem(STORE.sizes);
  localStorage.removeItem(STORE.order);
  localStorage.removeItem(STORE.images);
  localStorage.removeItem(STORE.custom);
  localStorage.removeItem(STORE.galleries);
  idbOpen()
    .then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        })
    )
    .finally(() => location.reload());
}

if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = pwInput?.value || "";
    const pw2 = pw2Input?.value || "";

    if (pw.length < 4) {
      showAuthError("A senha precisa ter pelo menos 4 caracteres.");
      return;
    }

    if (authMode === "setup" || authMode === "change") {
      if (pw !== pw2) {
        showAuthError("As senhas não coincidem.");
        return;
      }
      const hash = await sha256(pw);
      localStorage.setItem(STORE.hash, hash);
      if (authMode === "change") {
        showAuthError("");
        closeAuthModal();
        alert("Senha atualizada.");
        return;
      }
      enableEditMode();
      return;
    }

    const stored = localStorage.getItem(STORE.hash);
    if (!stored) {
      openAuthModal("setup");
      return;
    }
    const hash = await sha256(pw);
    if (hash !== stored) {
      showAuthError("Senha incorreta.");
      return;
    }
    enableEditMode();
  });
}

if (adminBar) {
  adminBar.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-admin]");
    if (!btn) return;
    if (!document.body.classList.contains("edit-mode") || !isUnlocked()) return;
    const action = btn.getAttribute("data-admin");
    if (action === "exit") disableEditMode();
    if (action === "help") openHelpModal();
    if (action === "hidden") openHiddenModal();
    if (action === "export") exportBackup();
    if (action === "password") openAuthModal("change");
    if (action === "reset") resetEdits();
    if (action === "publish-config") openPublishModal();
    if (action === "publish") publishToGitHub();
  });
}

const importInput = document.getElementById("admin-import");
if (importInput) {
  importInput.addEventListener("change", () => {
    const file = importInput.files && importInput.files[0];
    if (file) importBackup(file);
    importInput.value = "";
  });
}

if (publishForm) {
  publishForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!document.body.classList.contains("edit-mode") || !isUnlocked()) return;
    const { username, repo } = normalizePublishIdentity(
      publishUsername?.value,
      publishRepo?.value
    );
    const branch =
      (publishBranch?.value || PUBLISH_DEFAULTS.branch).trim() ||
      PUBLISH_DEFAULTS.branch;
    const token = (publishToken?.value || "").trim();
    if (!username || !repo || !token) {
      showPublishError("Preencha usuário, repositório e token.");
      return;
    }
    if (publishUsername) publishUsername.value = username;
    if (publishRepo) publishRepo.value = repo;
    if (publishBranch) publishBranch.value = branch;
    writeJson(STORE.publish, { username, repo, branch, token });
    showPublishError("");
    showPublishOk(
      `Configuração salva neste navegador (${username}/${repo}, branch ${branch}). Agora use Publicar na barra.`
    );
    updatePublishUrlPreview();
  });
}

function requestUnlock() {
  if (isUnlocked()) {
    enableEditMode();
    return;
  }
  openAuthModal(localStorage.getItem(STORE.hash) ? "login" : "setup");
}

const unlockLink = document.getElementById("admin-unlock-link");
if (unlockLink) {
  unlockLink.addEventListener("click", (e) => {
    e.preventDefault();
    requestUnlock();
  });
}

const logo = document.querySelector(".logo");
if (logo) {
  let pressTimer = null;
  const start = (e) => {
    if (e.type === "mousedown" && e.button !== 0) return;
    pressTimer = setTimeout(() => {
      requestUnlock();
    }, 800);
  };
  const cancel = () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  };
  logo.addEventListener("mousedown", start);
  logo.addEventListener("touchstart", start, { passive: true });
  logo.addEventListener("mouseup", cancel);
  logo.addEventListener("mouseleave", cancel);
  logo.addEventListener("touchend", cancel);
  logo.addEventListener("touchcancel", cancel);
}

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "E" || e.key === "e")) {
    e.preventDefault();
    requestUnlock();
  }
});

if (location.hash === "#admin") {
  history.replaceState(null, "", location.pathname + location.search);
  requestUnlock();
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(blob);
  });
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchPublishedJson() {
  try {
    const res = await fetch(`data/published.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== "object") return null;
    if (!data.publishedAt) return null;
    return data;
  } catch {
    return null;
  }
}

function applyPublishedText(text) {
  if (!text || typeof text !== "object") return;
  Object.keys(text).forEach((id) => {
    const el = document.querySelector(`[data-edit="${CSS.escape(id)}"]`);
    if (!el) return;
    el.innerHTML = text[id];
    el.querySelectorAll(".text-box-handle, .text-box-move").forEach((n) => n.remove());
  });
}

function applyPublishedBoxes(boxes) {
  if (!boxes || typeof boxes !== "object") return;
  Object.keys(boxes).forEach((id) => {
    const el = document.querySelector(`[data-edit="${CSS.escape(id)}"]`);
    if (el) applyBoxToElement(el, boxes[id]);
  });
}

function applyPublishedSizes(sizes) {
  if (!sizes || typeof sizes !== "object") return;
  document.querySelectorAll("[data-media-id]").forEach((el) => {
    const id = el.getAttribute("data-media-id");
    applySizeToElement(el, sizes[id] || "m");
  });
}

function applyPublishedOrder(order) {
  if (!order || typeof order !== "object") return;
  Object.keys(order).forEach((key) => {
    const ids = order[key];
    if (!Array.isArray(ids) || !ids.length) return;
    const container = document.querySelector(`[data-order-key="${CSS.escape(key)}"]`);
    if (!container) return;
    ids.forEach((id) => {
      const child = container.querySelector(`:scope > [data-media-id="${CSS.escape(String(id))}"]`);
      if (child) container.appendChild(child);
    });
  });
}

function applyPublishedHidden(hidden) {
  const list = Array.isArray(hidden) ? hidden : [];
  let style = document.getElementById("ramile-kit-hide");
  if (!style) {
    style = document.createElement("style");
    style.id = "ramile-kit-hide";
    document.documentElement.appendChild(style);
  }
  style.textContent = list
    .map((id) => `[data-media-id="${String(id).replace(/"/g, "")}"]{display:none!important}`)
    .join("");
}

async function applyPublishedImages(images) {
  if (!images || typeof images !== "object") return;
  for (const id of Object.keys(images)) {
    const entry = images[id];
    if (!entry) continue;
    const el = document.querySelector(`[data-media-id="${CSS.escape(id)}"]`);
    const img = el?.querySelector("img");
    if (!img) continue;
    if (entry.dataUrl) img.src = entry.dataUrl;
    else if (entry.src) img.src = entry.src;
  }
}

async function applyPublishedCustom(list) {
  if (!Array.isArray(list) || !list.length) return;
  for (const entry of list) {
    if (!entry?.id) continue;
    const adapted = {
      id: entry.id,
      kind: entry.kind,
      type: entry.type || "image",
      captionId: entry.captionId,
      label: entry.label,
      caption: entry.caption,
      src: entry.dataUrl || entry.src || "",
    };
    if (!adapted.src) continue;
    const el = await renderCustomCard(adapted);
    if (!el || el.parentElement) continue;
    let container;
    if (entry.kind === "story") container = document.getElementById("story-videos");
    else if (entry.kind === "couple") container = document.querySelector(".couple-grid");
    else container = document.querySelector(".photo-grid");
    if (container) container.appendChild(el);
  }
}

async function applyPublishedState(data) {
  if (data.galleries && typeof data.galleries === "object") {
    nicheGalleries = cloneGalleries(DEFAULT_GALLERIES);
    Object.keys(DEFAULT_GALLERIES).forEach((key) => {
      if (data.galleries[key] && Array.isArray(data.galleries[key].items)) {
        nicheGalleries[key] = {
          title: data.galleries[key].title || DEFAULT_GALLERIES[key].title,
          items: data.galleries[key].items,
        };
      }
    });
  } else {
    nicheGalleries = cloneGalleries(DEFAULT_GALLERIES);
  }
  await applyPublishedCustom(data.custom);
  await applyPublishedImages(data.images);
  applyPublishedText(data.text);
  applyPublishedBoxes(data.boxes);
  applyPublishedSizes(data.sizes);
  applyPublishedOrder(data.order);
  applyPublishedHidden(data.hidden);
}

async function tryEmbedBlob(blobId, warnings, label) {
  if (!blobId) return null;
  const blob = await idbGetBlob(blobId);
  if (!blob) {
    warnings.push(`${label}: arquivo local não encontrado.`);
    return null;
  }
  if (blob.type && blob.type.startsWith("video/")) {
    warnings.push(
      `${label}: vídeo grande no navegador não vai para o GitHub. Coloque em assets/ e publique o HTML, ou use o caminho assets/videos/…`
    );
    return null;
  }
  if (blob.size > PUBLISH_MAX_EMBED_BYTES) {
    warnings.push(
      `${label}: imagem grande demais (${Math.round(blob.size / 1024)} KB). Use um arquivo menor ou coloque em assets/.`
    );
    return null;
  }
  try {
    const dataUrl = await blobToDataUrl(blob);
    return { dataUrl, mime: blob.type || "image/jpeg" };
  } catch {
    warnings.push(`${label}: não foi possível ler o arquivo.`);
    return null;
  }
}

async function serializeGalleryForPublish(warnings) {
  const out = {};
  for (const key of Object.keys(nicheGalleries)) {
    const gal = nicheGalleries[key];
    const items = [];
    for (let i = 0; i < gal.items.length; i += 1) {
      const item = gal.items[i];
      if (item.blobId) {
        if (item.type === "video") {
          if (item.src) {
            items.push({ type: "video", src: item.src, alt: item.alt || "" });
          } else {
            warnings.push(`Galeria ${key} #${i + 1}: vídeo só no navegador — omitido. Prefira assets/videos/.`);
          }
          continue;
        }
        const embedded = await tryEmbedBlob(item.blobId, warnings, `Galeria ${key} #${i + 1}`);
        if (embedded) {
          items.push({ type: "image", dataUrl: embedded.dataUrl, alt: item.alt || "", mime: embedded.mime });
        } else if (item.src) {
          items.push({ type: item.type || "image", src: item.src, alt: item.alt || "" });
        }
        continue;
      }
      if (item.src || item.dataUrl) {
        items.push({
          type: item.type || "image",
          src: item.src,
          dataUrl: item.dataUrl,
          alt: item.alt || "",
        });
      }
    }
    out[key] = { title: gal.title, items };
  }
  return out;
}

async function collectPublishPayload(previousPublished) {
  const warnings = [];
  const images = {};
  const imageMap = getImagesMap();
  for (const id of Object.keys(imageMap)) {
    const entry = imageMap[id];
    if (!entry?.blobId) continue;
    const embedded = await tryEmbedBlob(entry.blobId, warnings, `Foto trocada (${id})`);
    if (embedded) images[id] = { dataUrl: embedded.dataUrl, mime: embedded.mime, updatedAt: entry.updatedAt };
  }
  /* Never wipe photos already on GitHub if this browser couldn't re-embed them */
  const prevImages =
    previousPublished && typeof previousPublished.images === "object" ? previousPublished.images : {};
  Object.keys(prevImages).forEach((id) => {
    if (images[id]) return;
    const prev = prevImages[id];
    if (prev && (prev.dataUrl || prev.src)) images[id] = prev;
  });

  const custom = [];
  for (const entry of getCustomMedia()) {
    if (entry.type === "video" && entry.blobId && !entry.src) {
      warnings.push(`Mídia adicionada (${entry.label || entry.id}): vídeo só no navegador — omitido.`);
      continue;
    }
    const row = {
      id: entry.id,
      kind: entry.kind,
      type: entry.type,
      captionId: entry.captionId,
      label: entry.label,
      caption: entry.caption,
    };
    if (entry.src) {
      row.src = entry.src;
      custom.push(row);
      continue;
    }
    if (entry.blobId) {
      const embedded = await tryEmbedBlob(entry.blobId, warnings, entry.label || entry.id);
      if (embedded) {
        row.dataUrl = embedded.dataUrl;
        row.mime = embedded.mime;
        custom.push(row);
      }
    }
  }

  const galleries = await serializeGalleryForPublish(warnings);

  const payload = {
    version: 1,
    publishedAt: new Date().toISOString(),
    text: getTextMap(),
    boxes: getBoxesMap(),
    hidden: getHidden(),
    labels: getLabels(),
    sizes: getSizesMap(),
    order: getOrderMap(),
    images,
    custom,
    galleries,
  };

  const json = JSON.stringify(payload);
  if (json.length > PUBLISH_MAX_JSON_CHARS) {
    warnings.push(
      "O pacote publicado ficou grande demais. Remova fotos trocadas grandes ou use arquivos em assets/."
    );
  }

  return { payload, json, warnings };
}

function decodeGithubFileContent(content, encoding) {
  if (!content) return "";
  const raw = String(content).replace(/\n/g, "");
  if (encoding && encoding !== "base64") return raw;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** GET data/published.json via Contents API — returns { sha, data } or { sha:null, data:null } */
async function githubGetPublished(cfg) {
  const path = "data/published.json";
  const owner = encodeURIComponent(cfg.username);
  const repo = encodeURIComponent(cfg.repo);
  const branch = cfg.branch || PUBLISH_DEFAULTS.branch;
  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${cfg.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, {
    headers,
  });
  if (getRes.ok) {
    const existing = await getRes.json();
    let data = null;
    try {
      const text = decodeGithubFileContent(existing.content, existing.encoding);
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return { sha: existing.sha, data };
  }
  if (getRes.status === 401 || getRes.status === 403) {
    const errText = await getRes.text();
    throw new Error(githubApiErrorMessage(getRes.status, errText, "read"));
  }
  if (getRes.status !== 404) {
    const errText = await getRes.text();
    throw new Error(githubApiErrorMessage(getRes.status, errText, "read"));
  }
  return { sha: null, data: null };
}

async function githubPutPublished(cfg, json, sha) {
  const path = "data/published.json";
  const owner = encodeURIComponent(cfg.username);
  const repo = encodeURIComponent(cfg.repo);
  const branch = cfg.branch || PUBLISH_DEFAULTS.branch;
  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${cfg.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  // 404 on GET: arquivo ainda não existe OU token inválido (GitHub mascara auth).
  // Segue para PUT; se for auth, o PUT também falha com mensagem clara.

  const body = {
    message: `Publicar conteúdo do site · ${new Date().toISOString()}`,
    content: utf8ToBase64(json),
    branch,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiBase, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(githubApiErrorMessage(putRes.status, errText, "write"));
  }
  return putRes.json();
}

async function publishToGitHub() {
  if (!document.body.classList.contains("edit-mode") || !isUnlocked()) {
    alert("Publicar só está disponível no modo edição.");
    return;
  }
  const raw = getPublishConfig();
  if (!raw?.token) {
    openPublishModal();
    showPublishError("Configure usuário, repositório e token antes de publicar.");
    return;
  }
  const identity = normalizePublishIdentity(
    raw.username || PUBLISH_DEFAULTS.username,
    raw.repo || PUBLISH_DEFAULTS.repo
  );
  const cfg = {
    username: identity.username,
    repo: identity.repo,
    branch: (raw.branch || PUBLISH_DEFAULTS.branch).trim() || PUBLISH_DEFAULTS.branch,
    token: String(raw.token || "").trim(),
  };
  if (!cfg.username || !cfg.repo || !cfg.token) {
    openPublishModal();
    showPublishError("Configure usuário, repositório e token antes de publicar.");
    return;
  }

  const publishBtn = adminBar?.querySelector('[data-admin="publish"]');
  const prevLabel = publishBtn?.textContent;
  if (publishBtn) {
    publishBtn.disabled = true;
    publishBtn.textContent = "Publicando…";
  }

  try {
    const remote = await githubGetPublished(cfg);
    const { payload, json, warnings } = await collectPublishPayload(remote.data);
    if (json.length > PUBLISH_MAX_JSON_CHARS) {
      alert(warnings.join("\n") || "Pacote grande demais para publicar.");
      return;
    }
    if (warnings.length) {
      const proceed = confirm(
        "Alguns itens não entram no site público:\n\n" +
          warnings.slice(0, 8).join("\n") +
          (warnings.length > 8 ? `\n…e mais ${warnings.length - 8}.` : "") +
          "\n\nContinuar publicando o restante? (fotos já publicadas antes são mantidas.)"
      );
      if (!proceed) return;
    }
    await githubPutPublished(cfg, json, remote.sha);
    const url = publicSiteUrl(cfg);
    const photoCount = payload.images ? Object.keys(payload.images).length : 0;
    alert(
      "Publicado!\n\nEm 1–2 minutos o site ao vivo deve atualizar:\n" +
        url +
        `\n\nTextos, layout, ocultos e ${photoCount} foto(s) trocada(s) foram enviados. Vídeos grandes precisam estar em assets/.`
    );
  } catch (err) {
    console.error(err);
    alert(err?.message || "Não foi possível publicar. Verifique a configuração.");
    openPublishModal();
    showPublishError(err?.message || "Falha ao publicar.");
  } finally {
    if (publishBtn) {
      publishBtn.disabled = false;
      publishBtn.textContent = prevLabel || "Publicar";
    }
  }
}

async function applyDraftFromStorage() {
  loadGalleriesFromStorage();
  await renderAllCustomMedia();
  await applyImageOverrides();
  applyTextOverrides();
  applyBoxes();
  applySizes();
  applyOrder();
  refreshHideStyle();
}

async function bootKit() {
  try {
    await idbOpen();
  } catch (err) {
    console.warn("IndexedDB indisponível", err);
  }
  migrateNarrowBoxWidths();
  ensureAddButtons();

  const editing = isUnlocked();
  if (editing) {
    await enableEditMode();
    return;
  }

  const published = await fetchPublishedJson();
  if (published) {
    await applyPublishedState(published);
    /* Keep Trocar foto from this browser even if published.json still has empty images */
    await applyImageOverrides();
    return;
  }

  await applyDraftFromStorage();
}

bootKit();
