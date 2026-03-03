// Firebase конфиг и инициализация
const firebaseConfig = {
    apiKey: "AIzaSyA-FGoB1L-euPEfGZvTN0pyfyLGZY4zGyE",
    authDomain: "ilyaklass-b11c0.firebaseapp.com",
    projectId: "ilyaklass-b11c0",
    storageBucket: "ilyaklass-b11c0.firebasestorage.app",
    messagingSenderId: "803990572684",
    appId: "1:803990572684:web:f10f6399a2c0c035e5b5a9",
    databaseURL: "https://ilyaklass-b11c0-default-rtdb.firebaseio.com/"
};

// Инициализация Firebase
try {
    firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.log('Firebase already initialized');
}

const auth = firebase.auth();
const db = firebase.database();
const provider = new firebase.auth.GoogleAuthProvider();

// Глобальные переменные
let currentUser = null;
let userRole = null;
let userFullName = null;
let userIsModerator = false;
let teacherSubjects = [];
let selectedSubject = 'all';
let quizType = 'kahoot';
let allSubjects = [];

// Локальная заглушка для аватара (без Gravatar)
const DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'45\' fill=\'%23333\' stroke=\'%23ffd700\' stroke-width=\'2\'/%3E%3Ctext x=\'50\' y=\'67\' font-size=\'40\' text-anchor=\'middle\' fill=\'%23ffd700\' font-family=\'Arial\'%3E👤%3C/text%3E%3C/svg%3E';

// Функция для очистки имени от модераторских скобок
function cleanDisplayName(name) {
    if (!name) return name;
    return name.replace(/\s*\(\d+\)$/, '');
}

// Функция для проверки, является ли пользователь модератором
function checkIfModerator(name) {
    if (!name) return false;
    return /\s*\(\d+\)$/.test(name);
}
