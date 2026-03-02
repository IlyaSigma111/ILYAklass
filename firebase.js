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
firebase.initializeApp(firebaseConfig);
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
