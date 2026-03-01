// firebase.js - Твой конфиг и общие функции

const firebaseConfig = {
    apiKey: "AIzaSyA-FGoB1L-euPEfGZvTN0pyfyLGZY4zGyE",
    authDomain: "ilyaklass-b11c0.firebaseapp.com",
    projectId: "ilyaklass-b11c0",
    storageBucket: "ilyaklass-b11c0.firebasestorage.app",
    messagingSenderId: "803990572684",
    appId: "1:803990572684:web:f10f6399a2c0c035e5b5a9",
    databaseURL: "https://ilyaklass-b11c0-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const provider = new firebase.auth.GoogleAuthProvider();

let currentUser = null;
let userRole = null;
let userFullName = null;

// Проверка авторизации
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        
        const userRef = db.ref('users/' + user.uid);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (userData) {
            userRole = userData.role;
            userFullName = userData.fullName;
            
            updateUserInterface();
            
            if (typeof loadPageContent === 'function') {
                loadPageContent();
            }
        } else {
            // Новый пользователь - показываем выбор роли
            showRoleModal();
        }
    } else {
        currentUser = null;
        userRole = null;
        userFullName = null;
        updateUserInterface();
    }
});

function signIn() {
    auth.signInWithPopup(provider);
}

function signOut() {
    auth.signOut();
    window.location.href = 'index.html';
}

async function selectRole(role) {
    if (!currentUser) return;
    
    // Сначала сохраняем роль
    await db.ref('users/' + currentUser.uid).set({
        email: currentUser.email,
        googleName: currentUser.displayName,
        avatar: currentUser.photoURL,
        role: role,
        fullName: '', // Пока пусто, запросим позже
        registeredAt: firebase.database.ServerValue.TIMESTAMP
    });
    
    document.getElementById('roleModal').style.display = 'none';
    
    // Запрашиваем ФИО
    showNameModal();
}

function showNameModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'nameModal';
    modal.innerHTML = `
        <div class="role-modal" style="max-width: 400px;">
            <h2 style="color: #ffd700;">Введите ваши данные</h2>
            <p style="color: #aaa; margin: 1rem 0;">Это нужно для отображения в списках учеников</p>
            <div class="form-group">
                <label>Фамилия и Имя</label>
                <input type="text" id="fullNameInput" placeholder="Например: Иванов Иван" style="width: 100%; padding: 1rem; border-radius: 15px; background: #0f172a; border: 2px solid #ffd700; color: white;">
            </div>
            <button class="submit-quiz" onclick="saveFullName()" style="margin-top: 1rem;">Сохранить</button>
        </div>
    `;
    document.body.appendChild(modal);
}

async function saveFullName() {
    const fullName = document.getElementById('fullNameInput').value;
    if (!fullName) {
        alert('Введите фамилию и имя');
        return;
    }
    
    await db.ref('users/' + currentUser.uid).update({
        fullName: fullName
    });
    
    userFullName = fullName;
    document.getElementById('nameModal').remove();
    window.location.reload();
}

function updateUserInterface() {
    const userSection = document.getElementById('userSection');
    if (!userSection) return;
    
    if (currentUser) {
        userSection.innerHTML = `
            <div class="user-card">
                <img src="${currentUser.photoURL}" class="avatar">
                <span>${userFullName || currentUser.displayName}</span>
                <span class="role-badge">${userRole === 'teacher' ? '👨‍🏫 Учитель' : '👨‍🎓 Ученик'}</span>
                <button onclick="signOut()" class="logout-btn">Выйти</button>
            </div>
        `;
    } else {
        userSection.innerHTML = ''; // Убираем кнопку из шапки
    }
}

function showRoleModal() {
    const modal = document.getElementById('roleModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}
