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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const provider = new firebase.auth.GoogleAuthProvider();

// Глобальные переменные
let currentUser = null;
let userRole = null;
let userFullName = null;
let teacherSubjects = [];
let selectedSubject = null;
let quizType = 'kahoot';

// Список предметов с иконками
const subjects = [
    { name: 'Русский язык', icon: '📖' },
    { name: 'Алгебра', icon: '🔢' },
    { name: 'Геометрия', icon: '📐' },
    { name: 'Математика', icon: '🧮' },
    { name: 'Химия', icon: '🧪' },
    { name: 'Физика', icon: '⚡' },
    { name: 'Литература', icon: '📚' },
    { name: 'Английский язык', icon: '🇬🇧' },
    { name: 'История', icon: '🏛️' },
    { name: 'Физкультура', icon: '⚽' }
];
