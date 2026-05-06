import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    collection, 
    addDoc, 
    onSnapshot, 
    query,
    where,
    getDocs,
    updateDoc,
    doc,
    arrayUnion,
    setDoc,
    getDoc,
    writeBatch,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDhVeYq4ZuRPVsgSS7Rj45qgp8f5Cub4k0",
  authDomain: "web-apps-306dc.firebaseapp.com",
  projectId: "web-apps-306dc",
  storageBucket: "web-apps-306dc.firebasestorage.app",
  messagingSenderId: "252030409819",
  appId: "1:252030409819:web:d280855334dc2b1707f37e",
  measurementId: "G-V44WT4E56B"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});
const auth = getAuth(app);

// Device ID for simple user isolation (legacy/guest mode)
let deviceId = localStorage.getItem('device_id');
if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_id', deviceId);
}

let currentUser = null;
let currentWatchlistRef = collection(db, `users/${deviceId}/watchlist`);

// Auth Observer
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        console.log("Logged in as:", user.email);
        currentWatchlistRef = collection(db, `users/${user.uid}/watchlist`);
        // Check for migration
        migrateGuestData(user.uid);
    } else {
        console.log("Not logged in. Using device ID:", deviceId);
        currentWatchlistRef = collection(db, `users/${deviceId}/watchlist`);
    }
    // Re-initialize UI/listeners
    initApp();
});

// MIGRATION LOGIC: Move data from deviceId to user UID
async function migrateGuestData(uid) {
    const guestRef = collection(db, `users/${deviceId}/watchlist`);
    const guestSnapshot = await getDocs(guestRef);
    
    if (guestSnapshot.empty) return;
    
    console.log(`Migrating ${guestSnapshot.size} items to account...`);
    const batch = writeBatch(db);
    
    guestSnapshot.forEach((itemDoc) => {
        const newDataRef = doc(db, `users/${uid}/watchlist`, itemDoc.id);
        batch.set(newDataRef, itemDoc.data());
        // We don't delete immediately to be safe, or we could delete here
    });
    
    await batch.commit();
    console.log("Migration complete!");
}

// Global Auth Functions
window.authFunctions = {
    signup: (email, password, username) => {
        return createUserWithEmailAndPassword(auth, email, password)
            .then(async (userCredential) => {
                await updateProfile(userCredential.user, { displayName: username });
                return userCredential.user;
            });
    },
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    logout: () => signOut(auth),
    getCurrentUser: () => auth.currentUser
};

// Expose globally so camera.html can use it
window.saveToWatchlist = async function(item) {
    try {
        const q = query(currentWatchlistRef, where("title", "==", item.seriesName));
        const querySnapshot = await getDocs(q);
        
        const newVolume = {
            id: item.volumeId,
            title: item.volumeTitle,
            cover: item.cover,
            dateAdded: new Date().toISOString()
        };

        if (!querySnapshot.empty) {
            const existingDoc = querySnapshot.docs[0];
            const docRef = doc(db, currentWatchlistRef.path, existingDoc.id);
            
            const existingData = existingDoc.data();
            const hasVolume = existingData.volumes && existingData.volumes.find(v => v.id === item.volumeId);
            if (hasVolume) return false;

            await updateDoc(docRef, {
                volumes: arrayUnion(newVolume)
            });
            return true;
        }
        
        await addDoc(currentWatchlistRef, {
            title: item.seriesName,
            type: item.type,
            author: item.author,
            category: item.category,
            cover: item.cover,
            episodes: item.episodes || null,
            status: item.status || null,
            broadcast: item.broadcast || null,
            malId: item.malId || null,
            volumes: [newVolume],
            isGrouped: true
        });
        return true;
    } catch (e) {
        console.error("Error adding to Firestore: ", e);
        return false;
    }
}

function formatCountdown(distance) {
  if (distance < 0) return "Airing Now / Out!";
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  let out = "";
  if (days > 0) out += `${days}d `;
  out += `${hours.toString().padStart(2, '0')}:`;
  out += `${minutes.toString().padStart(2, '0')}:`;
  out += `${seconds.toString().padStart(2, '0')}`;
  return out;
}

// Parses "Wednesdays at 21:55 (JST)" -> UTC timestamp of next occurrence
function parseNextAiring(broadcastStr) {
    if (!broadcastStr) return null;
    const match = broadcastStr.match(/(\w+)\s+at\s+(\d{1,2}:\d{2})/i);
    if (!match) return null;
    const dayMap = {
        mondays:1, tuesdays:2, wednesdays:3, thursdays:4, fridays:5, saturdays:6, sundays:0,
        monday:1,  tuesday:2,  wednesday:3,  thursday:4,  friday:5,  saturday:6,  sunday:0
    };
    const targetDay = dayMap[match[1].toLowerCase()];
    if (targetDay === undefined) return null;
    const [hours, minutes] = match[2].split(':').map(Number);
    const JST = 9 * 3600 * 1000;
    const nowUtc = Date.now();
    const nowJst = new Date(nowUtc + JST);
    const tgt = new Date(nowUtc + JST);
    tgt.setUTCHours(hours, minutes, 0, 0);
    let daysUntil = (targetDay - nowJst.getUTCDay() + 7) % 7;
    if (daysUntil === 0 && tgt.getTime() <= nowJst.getTime()) daysUntil = 7;
    tgt.setUTCDate(tgt.getUTCDate() + daysUntil);
    return tgt.getTime() - JST; // back to UTC ms
}
window.parseNextAiring = parseNextAiring;

function renderCards(watchlist) {
  const homeAnimeContainer = document.getElementById('anime-grid');
  const libAnimeContainer = document.getElementById('lib-anime-grid');
  const libBookContainer = document.getElementById('lib-book-grid');
  const libMiscContainer = document.getElementById('lib-misc-grid');
  
  if (homeAnimeContainer) homeAnimeContainer.innerHTML = ''; 
  if (libAnimeContainer) libAnimeContainer.innerHTML = '';
  if (libBookContainer) libBookContainer.innerHTML = '';
  if (libMiscContainer) libMiscContainer.innerHTML = '';
  
  let counts = { anime: 0, book: 0, misc: 0 };
  
  let totalVolumes = 0;
  watchlist.forEach(item => {
      totalVolumes += (item.isGrouped && item.volumes) ? item.volumes.length : 1;
  });
  
  const statCount = document.getElementById('stat-count');
  if (statCount) statCount.innerText = totalVolumes;
  
  watchlist.forEach(item => {
    const card = document.createElement('div');
    card.className = 'anime-card';
    const bgStyle = item.cover ? `background-image: url('${item.cover}');` : `background: var(--accent-gradient)`;
    
    const volCount = item.isGrouped && item.volumes ? item.volumes.length : 1;
    const volText = volCount === 1 ? '1 Volume' : `${volCount} Volumes`;

    if (item.type === 'anime') {
        counts.anime++;
        const badgeText = item.status === 'Currently Airing' ? 'Airing' : (item.status === 'Finished Airing' ? 'Completed' : 'Saved');
        const totalEp = item.episodes ? item.episodes : '?';
        const epPlaceholder = item.status === 'Currently Airing' ? `? / ${totalEp} Episodes` : (item.episodes ? `${item.episodes} Episodes` : (item.author || item.category));
        const epId = `ep-count-${item.docId}`;
        const nextMs = item.broadcast ? parseNextAiring(item.broadcast) : null;
        const countdownInner = nextMs
            ? `<div class="countdown-text cd-timer" data-time="${nextMs}" style="font-size: 0.95rem; color: var(--accent-secondary); font-weight: 700; letter-spacing:1px;">--:--:--</div>`
            : `<div class="countdown-text" style="font-size: 1rem; color: #9aa0a6;">${item.status === 'Currently Airing' ? 'Airing Now' : (item.status || 'In Library')}</div>`;

        card.innerHTML = `
          <div class="card-image" style="${bgStyle}">
            <div class="status-badge">${badgeText}</div>
          </div>
          <div class="card-content" style="position: relative;">
            <button class="remove-btn" data-id="${item.docId}" style="position: absolute; top: 10px; right: 10px; background: rgba(255,77,77,0.2); color: #ff4d4d; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
              <i class="fa-solid fa-trash" style="font-size: 0.8rem;"></i>
            </button>
            <h3 class="card-title" style="padding-right: 25px;">${item.title}</h3>
            <p class="card-episode" id="${epId}">${epPlaceholder}</p>
            <div class="countdown-box" style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1);">
              ${countdownInner}
            </div>
          </div>
        `;

        // If currently airing and we have a malId, fetch live aired episode count
        if (item.status === 'Currently Airing' && item.malId) {
            fetch(`https://api.jikan.moe/v4/anime/${item.malId}`)
                .then(r => r.json())
                .then(d => {
                    const aired = d.data?.episodes_aired ?? null;
                    const total = d.data?.episodes ?? totalEp;
                    const el = document.getElementById(epId);
                    if (el) {
                        el.innerText = aired !== null ? `${aired} / ${total} Episodes` : (total ? `${total} Episodes` : 'Airing');
                    }
                    // also update the clone in the home grid
                    const homeEl = document.querySelector(`#anime-grid #${epId}`);
                    if (homeEl) homeEl.innerText = aired !== null ? `${aired} / ${total} Episodes` : `${total} Episodes`;
                })
                .catch(() => {}); // silently fail, placeholder stays
        }

        if (homeAnimeContainer) homeAnimeContainer.appendChild(card.cloneNode(true));
        if (libAnimeContainer) libAnimeContainer.appendChild(card);
        
    } else if (item.type === 'book' || item.type === 'manga' || item.type === 'novel') {
        counts.book++;
        card.innerHTML = `
          <div class="card-image" style="${bgStyle}">
            <div class="status-badge" style="color: #fff; background: var(--accent-primary)">Book</div>
          </div>
          <div class="card-content" style="position: relative;">
            <button class="remove-btn" data-id="${item.docId}" style="position: absolute; top: 10px; right: 10px; background: rgba(255,77,77,0.2); color: #ff4d4d; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
              <i class="fa-solid fa-trash" style="font-size: 0.8rem;"></i>
            </button>
            <h3 class="card-title" style="padding-right: 25px;">${item.title}</h3>
            <p class="card-episode">${item.author || item.category}</p>
            <div class="countdown-box" style="background: var(--glass-bg); border-color: var(--glass-border);">
              <div class="countdown-text" style="font-size: 1rem; color: var(--text-secondary);">${volText}</div>
            </div>
          </div>
        `;
        if (libBookContainer) libBookContainer.appendChild(card);
        
    } else {
        counts.misc++;
        card.innerHTML = `
          <div class="card-image" style="${bgStyle}">
            <div class="status-badge" style="background: #333;">Misc</div>
          </div>
          <div class="card-content" style="position: relative;">
            <button class="remove-btn" data-id="${item.docId}" style="position: absolute; top: 10px; right: 10px; background: rgba(255,77,77,0.2); color: #ff4d4d; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
              <i class="fa-solid fa-trash" style="font-size: 0.8rem;"></i>
            </button>
            <h3 class="card-title" style="padding-right: 25px;">${item.title}</h3>
            <p class="card-episode">${item.author || item.category}</p>
            <div class="countdown-box" style="background: var(--glass-bg); border-color: var(--glass-border);">
              <div class="countdown-text" style="font-size: 1rem; color: var(--text-secondary);">${volText}</div>
            </div>
          </div>
        `;
        if (libMiscContainer) libMiscContainer.appendChild(card);
    }
  });

  // Attach delete logic
  document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const docId = e.currentTarget.getAttribute('data-id');
          if (confirm("Are you sure you want to remove this series from your library?")) {
              try {
                  await deleteDoc(doc(db, currentWatchlistRef.path, docId));
              } catch (err) {
                  console.error("Error removing document: ", err);
                  alert("Failed to remove series.");
              }
          }
      });
  });
}

let snapshotUnsubscribe = null;

function initApp() {
    if (snapshotUnsubscribe) snapshotUnsubscribe();

    if (
        document.getElementById('anime-grid') || 
        document.getElementById('lib-anime-grid') || 
        document.getElementById('lib-book-grid') || 
        document.getElementById('lib-misc-grid') ||
        document.getElementById('stat-count')
    ) {
        snapshotUnsubscribe = onSnapshot(currentWatchlistRef, (snapshot) => {
            const list = [];
            snapshot.forEach((doc) => {
                list.push({ docId: doc.id, ...doc.data() });
            });
            // Expose saved malIds globally so schedule calendar can detect duplicates
            window.savedMalIds = new Set(list.map(i => String(i.malId)).filter(Boolean));
            window.savedTitles = new Set(list.map(i => (i.title || '').toLowerCase()));
            renderCards(list);
            // Notify schedule grid to update its buttons
            document.dispatchEvent(new CustomEvent('library-updated'));
        });
    }
}

function startCountdowns() {
  setInterval(() => {
    const now = new Date().getTime();
    const timers = document.querySelectorAll('.cd-timer');
    timers.forEach(el => {
        const targetTime = parseInt(el.getAttribute('data-time'), 10);
        const distance = targetTime - now;
        el.innerText = formatCountdown(distance);
    });
  }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    startCountdowns();
    
    const notifBtn = document.getElementById('demo-notification-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            if ('Notification' in window) {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification("Notifications Enabled!", {
                            body: "You will be alerted when new chapters drop.",
                            icon: 'assets/images/logo.png' 
                        });
                        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
                    }
                });
            }
        });
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => console.log('SW failed:', err));
        });
    }
});

