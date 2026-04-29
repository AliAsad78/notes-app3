// Simple cloud-like notes app using localStorage
(() => {
  // Elements
  const notesListEl = document.getElementById('notesList');
  const newBtn = document.getElementById('newBtn');
  const searchInput = document.getElementById('search');
  const noteTitle = document.getElementById('noteTitle');
  const noteContent = document.getElementById('noteContent');
  const deleteBtn = document.getElementById('deleteBtn');
  const statusEl = document.getElementById('status');
  const darkToggle = document.getElementById('darkToggle');

  const attachBtn = document.getElementById('attachBtn');
  const fileInput = document.getElementById('fileInput');
  const attachmentsContainer = document.getElementById('attachmentsContainer');
  const saveBtn = document.getElementById('saveBtn');

  // Keys & state
  const STORAGE_KEY = 'cloud_notes_v1';
  let notes = []; // {id,title,content,updated,attachments: [{name,type,data}]}
  let activeId = null;
  let autosaveTimer = null;

  // Helpers
  const nowISO = () => new Date().toISOString();
  const saveAll = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  };
  const loadAll = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      notes = raw ? JSON.parse(raw) : [];
    } catch {
      notes = [];
    }
  };

  // Render list
  function renderList(filter = '') {
    notesListEl.innerHTML = '';
    const q = filter.trim().toLowerCase();
    const sorted = notes.slice().sort((a,b)=> b.updated.localeCompare(a.updated));
    const shown = q ? sorted.filter(n => ((n.title||'') + ' ' + (n.content||'')).toLowerCase().includes(q)) : sorted;
    if(shown.length === 0){
      notesListEl.innerHTML = `<div class="note-item" style="opacity:.6"><div class="note-title">No notes</div><div class="note-preview">Create a new note to get started.</div></div>`;
      return;
    }
    for (const n of shown) {
      const el = document.createElement('div');
      el.className = 'note-item';
      el.dataset.id = n.id;
      el.innerHTML = `
        <div class="note-title">${escapeHtml(n.title || 'Untitled')}</div>
        <div class="note-preview">${escapeHtml(n.content || '')}</div>
        <div class="note-meta"><span>${timeAgo(n.updated)}</span><span>${(n.content||'').length} chars</span></div>
      `;
      if (n.id === activeId) el.style.boxShadow = '0 8px 26px rgba(37,99,235,0.12)';
      el.addEventListener('click', ()=> setActive(n.id));
      notesListEl.appendChild(el);
    }
  }

  // Escape HTML
  function escapeHtml(s=''){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}

  // Time ago
  function timeAgo(iso){
    const d = new Date(iso); const s = Math.floor((Date.now() - d)/1000);
    if (s<10) return 'just now';
    if (s<60) return `${s}s`;
    if (s<3600) return `${Math.floor(s/60)}m`;
    if (s<86400) return `${Math.floor(s/3600)}h`;
    return d.toLocaleString();
  }

  // New note
  function createNote(){
    const id = 'n_'+Date.now();
    const note = {id, title:'', content:'', updated:nowISO(), attachments: []};
    notes.push(note);
    saveAll();
    setActive(id);
    renderList(searchInput.value);
  }

  // Set active
  function setActive(id){
    const n = notes.find(x=>x.id===id);
    if(!n) return;
    activeId = id;
    noteTitle.value = n.title || '';
    noteContent.value = n.content || '';
    status('Loaded');
    renderList(searchInput.value);
    renderAttachments();
    noteContent.focus();
    try{history.replaceState(null,'', '#'+id);}catch{}
  }

  // Update note fields (autosave/manual save uses this)
  function updateActiveFromInputs(){
    if(!activeId) return;
    const n = notes.find(x=>x.id===activeId);
    if(!n) return;
    n.title = noteTitle.value;
    n.content = noteContent.value;
    n.updated = nowISO();
    // Ensure attachments array exists
    if (!Array.isArray(n.attachments)) n.attachments = [];
    renderList(searchInput.value);
  }

  // Autosave with debounce
  function scheduleAutosave(){
    status('Typing...');
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      if (!activeId) { status('Idle'); return; }
      updateActiveFromInputs();
      saveAll();
      status('Saved');
      setTimeout(()=> status('Idle'), 900);
      renderAttachments(); // ensure attachments area up-to-date
    }, 900);
  }

  // Manual save button handler
  function manualSave(){
    if(!activeId) {
      status('No active note');
      return;
    }
    updateActiveFromInputs();
    saveAll();
    status('Saved successfully ✔');
    setTimeout(()=> status('Idle'), 1400);
  }

  // Delete
  function deleteActive(){
    if(!activeId) return;
    const idx = notes.findIndex(n=>n.id===activeId);
    if(idx === -1) return;
    if(!confirm('Delete this note?')) return;
    notes.splice(idx,1);
    saveAll();
    activeId = notes[0]?.id || null;
    if(activeId) setActive(activeId); else { noteTitle.value=''; noteContent.value=''; attachmentsContainer.innerHTML=''; renderList(searchInput.value); }
  }

  // Attach file workflow
  attachBtn.addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  function handleFileSelect(e){
    const file = e.target.files && e.target.files[0];
    fileInput.value = ''; // reset for future same-file uploads
    if (!file) return;
    const supported = ['image/png','image/jpeg','application/pdf','text/plain'];
    // Basic extension allowance for .txt/.text and jpeg/jpg
    // If unsupported, ignore
    if (!supported.includes(file.type)) {
      alert('Unsupported file type. Allowed: jpg, png, pdf, txt.');
      return;
    }
    const reader = new FileReader();
    reader.onload = function(evt){
      const base64 = evt.target.result; // data:<type>;base64,xxxx
      // store minimal: name, type, data (base64 string)
      if(!activeId){
        // create a new note automatically if none active
        createNote();
      }
      const n = notes.find(x=>x.id===activeId);
      if(!n) return;
      if(!Array.isArray(n.attachments)) n.attachments = [];
      n.attachments.push({
        name: file.name,
        type: file.type,
        data: base64
      });
      n.updated = nowISO();
      saveAll();
      renderAttachments();
      renderList(searchInput.value);
      status('Attachment added');
      setTimeout(()=> status('Idle'), 900);
    };
    // read as data URL to preserve displayable content
    reader.readAsDataURL(file);
  }

  // Render attachments in attachmentsContainer
  function renderAttachments(){
    attachmentsContainer.innerHTML = '';
    if(!activeId) return;
    const n = notes.find(x=>x.id===activeId);
    if(!n || !Array.isArray(n.attachments) || n.attachments.length === 0) return;
    for (let i=0;i<n.attachments.length;i++){
      const a = n.attachments[i];
      const el = document.createElement('div');
      el.className = 'attachment';
      const info = document.createElement('div');
      info.className = 'info';
      const fname = document.createElement('div');
      fname.className = 'filename';
      fname.textContent = a.name || 'attachment';
      const ftype = document.createElement('div');
      ftype.className = 'ftype';
      ftype.textContent = a.type || '';
      info.appendChild(fname);
      info.appendChild(ftype);

      // Preview or links
      const actions = document.createElement('div');
      actions.className = 'actions';

      if (a.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.className = 'preview';
        img.src = a.data;
        img.alt = a.name;
        el.appendChild(img);
      }

      // Open/view button
      const viewBtn = document.createElement('button');
      viewBtn.className = 'btn';
      viewBtn.textContent = a.type === 'application/pdf' ? 'Open PDF' : 'View';
      viewBtn.addEventListener('click', ()=> {
        // open data URL in new tab
        try {
          const w = window.open();
          w.document.write(`<title>${escapeHtml(a.name)}</title>`);
          if (a.type === 'application/pdf') {
            // embed pdf
            w.document.write(`<embed src="${a.data}" type="application/pdf" width="100%" height="100%">`);
          } else if (a.type.startsWith('image/')) {
            w.document.write(`<img src="${a.data}" style="max-width:100%;height:auto">`);
          } else {
            // text file - show text content
            // a.data is data:<type>;base64,xxxx or data:text/plain;charset=...;base64,...
            // decode for display when possible
            if (a.data.startsWith('data:text')) {
              fetch(a.data).then(r=>r.text()).then(t=>{
                w.document.body.style.whiteSpace = 'pre-wrap';
                w.document.body.textContent = t;
              });
            } else {
              w.location.href = a.data;
            }
          }
        } catch (err) {
          // fallback: open data URL directly
          const link = document.createElement('a');
          link.href = a.data;
          link.target = '_blank';
          link.click();
        }
      });

      // Download button for non-images or all files
      const dlBtn = document.createElement('button');
      dlBtn.className = 'btn';
      dlBtn.textContent = 'Download';
      dlBtn.addEventListener('click', ()=> {
        const link = document.createElement('a');
        link.href = a.data;
        link.download = a.name || 'download';
        document.body.appendChild(link);
        link.click();
        link.remove();
      });

      // Remove attachment button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn danger';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', ()=> {
        if (!confirm('Remove this attachment?')) return;
        const idx = n.attachments.indexOf(a);
        if (idx > -1) n.attachments.splice(idx,1);
        n.updated = nowISO();
        saveAll();
        renderAttachments();
        renderList(searchInput.value);
        status('Attachment removed');
        setTimeout(()=> status('Idle'), 800);
      });

      actions.appendChild(viewBtn);
      actions.appendChild(dlBtn);
      actions.appendChild(removeBtn);

      el.appendChild(info);
      el.appendChild(actions);
      attachmentsContainer.appendChild(el);
    }
  }

  // Status helper
  function status(s){
    statusEl.textContent = s;
  }

  // Initialize
  function init(){
    loadAll();
    // Normalize existing notes to include attachments array
    notes = notes.map(n => ({ ...n, attachments: Array.isArray(n.attachments) ? n.attachments : [] }));

    // If none, create sample note
    if(notes.length === 0){
      notes.push({id:'n_'+Date.now(), title:'Welcome to Cloud Notes', content:'This demo saves notes to localStorage to simulate cloud storage. Create, edit, delete, and search your notes. Dark mode and autosave included. You can now attach images, PDFs, and text files to notes.', updated:nowISO(), attachments: []});
      saveAll();
    }

    // Restore theme
   
