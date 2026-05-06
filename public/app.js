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
    writeBatch
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
        card.innerHTML = `
          <div class="card-image" style="${bgStyle}">
            <div class="status-badge">Airing</div>
          </div>
          <div class="card-content">
            <h3 class="card-title">${item.title}</h3>
            <p class="card-episode">${item.author || item.category}</p>
            <div class="countdown-box">
              <div class="countdown-text cd-timer" data-time="${item.nextAiring || new Date().getTime() + 86400000}">--:--:--</div>
            </div>
          </div>
        `;
        if (homeAnimeContainer) homeAnimeContainer.appendChild(card.cloneNode(true));
        if (libAnimeContainer) libAnimeContainer.appendChild(card);
        
    } else if (item.type === 'book' || item.type === 'manga' || item.type === 'novel') {
        counts.book++;
        card.innerHTML = `
          <div class="card-image" style="${bgStyle}">
            <div class="status-badge" style="color: #fff; background: var(--accent-primary)">Book</div>
          </div>
          <div class="card-content">
            <h3 class="card-title">${item.title}</h3>
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
          <div class="card-content">
            <h3 class="card-title">${item.title}</h3>
            <p class="card-episode">${item.author || item.category}</p>
            <div class="countdown-box" style="background: var(--glass-bg); border-color: var(--glass-border);">
              <div class="countdown-text" style="font-size: 1rem; color: var(--text-secondary);">${volText}</div>
            </div>
          </div>
        `;
        if (libMiscContainer) libMiscContainer.appendChild(card);
    }
  });
}

let snapshotUnsubscribe = null;

function initApp() {
    if (snapshotUnsubscribe) snapshotUnsubscribe();

    if (
        document.getElementById('anime-grid') || 
        document.getElementById('lib-anime-grid') || 
        document.getElementById('lib-book-grid') || 
        document.getElementById('lib-misc-grid')
    ) {
        snapshotUnsubscribe = onSnapshot(currentWatchlistRef, (snapshot) => {
            const list = [];
            snapshot.forEach((doc) => {
                list.push({ docId: doc.id, ...doc.data() });
            });
            renderCards(list);
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

