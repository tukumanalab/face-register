// グローバル変数
let video;
let overlay;
let capturedFaceCanvas;
let stream;
let faceDetectionInterval;
let capturedFaceDescriptor = null;
let registeredFaces = [];
let isFaceDetected = false;
let isSingleFace = false;
let registerBtn;
let userIdInput;
let registerStatus;
let lastStatusMessage = ''; // 前回のステータスメッセージを保存する変数
let findUrl = '';

// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', async () => {
    // URLパラメータからAPI URLを取得（findUrlパラメータは必須）
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('findUrl')) {
        findUrl = urlParams.get('findUrl');
    }
    
    // 要素の取得
    video = document.getElementById('video');
    overlay = document.getElementById('overlay');
    capturedFaceCanvas = document.getElementById('captured-face');
    registerBtn = document.getElementById('register-btn');
    userIdInput = document.getElementById('user-id');
    registerStatus = document.getElementById('register-status');
    
    // URLパラメータからmemberIdが渡された場合、IDのテキストフィールドにデフォルト値として設定
    if (urlParams.has('memberId')) {
        userIdInput.value = urlParams.get('memberId');
        // 入力状態を更新して登録ボタンの状態を更新
        updateRegisterButtonState();
    }
    
    // 初期状態では登録ボタンを無効化
    registerBtn.disabled = true;
    
    // ユーザーIDの入力状態を監視
    userIdInput.addEventListener('input', updateRegisterButtonState);
    
    const registerForm = document.getElementById('register-form');
    
    // face-api.jsのモデルを読み込む
    await loadModels();
    
    // イベントリスナーの設定
    registerForm.addEventListener('submit', registerFace);
    
    // ページ読み込み時に自動的にカメラを起動
    toggleCamera();
});

// face-api.jsのモデルを読み込む関数
async function loadModels() {
    try {
        // モデルのパスを設定
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
        
        // 必要なモデルを読み込む
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        
        console.log('モデルの読み込みが完了しました');
    } catch (error) {
        console.error('モデルの読み込みに失敗しました:', error);
    }
}

// カメラを起動する関数
async function toggleCamera() {
    try {        
        // 制約を指定
        const constraints = { 
            audio: false,
            video: { 
                width: { ideal: 320 },
                height: { ideal: 240 },
                facingMode: 'user'
            } 
        };
        
        // カメラストリームを取得
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // ビデオ要素にストリームを設定
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
        };
        
        // 顔検出を開始
        startFaceDetection();
    } catch (error) {
        console.error('カメラの起動に失敗しました:', error);
        alert('カメラの起動に失敗しました。カメラへのアクセス許可を確認してください。');
    }
}

// カメラを停止する関数
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
        
        // 顔検出を停止
        stopFaceDetection();
        
        // オーバーレイをクリア
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
}

// 顔検出を開始する関数
function startFaceDetection() {
    if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
    }
    
    faceDetectionInterval = setInterval(async () => {
        if (video.paused || video.ended || !stream) {
            return;
        }
        
        try {
            // 顔を検出
            const detections = await faceapi.detectAllFaces(video)
                .withFaceLandmarks()
                .withFaceDescriptors();
            
            // オーバーレイに描画
            const ctx = overlay.getContext('2d');
            ctx.clearRect(0, 0, overlay.width, overlay.height);
            
            // 顔が検出されたかどうかと、顔が1つだけかどうかを更新
            isFaceDetected = detections.length > 0;
            isSingleFace = detections.length === 1;
            
            // 登録ボタンの状態を更新
            updateRegisterButtonState();
            
            if (isFaceDetected) {
                // 検出された顔に枠を描画
                const resizedDetections = faceapi.resizeResults(detections, {
                    width: overlay.width,
                    height: overlay.height
                });
                
                resizedDetections.forEach(detection => {
                    const box = detection.detection.box;
                    ctx.strokeStyle = '#00ff00';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(box.x, box.y, box.width, box.height);
                });
            }
        } catch (error) {
            console.error('顔検出中にエラーが発生しました:', error);
        }
    }, 500); // 100ミリ秒から500ミリ秒に変更して更新頻度を下げる
}

// 顔検出を停止する関数
function stopFaceDetection() {
    if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
        faceDetectionInterval = null;
    }
    
    // 顔検出が停止されたら状態をリセット
    isFaceDetected = false;
    isSingleFace = false;
    if (registerBtn) {
        updateRegisterButtonState();
    }
}

// 登録ボタンの状態を更新する関数
function updateRegisterButtonState() {
    const isUserIdEntered = userIdInput && userIdInput.value.trim() !== '';
    
    // 顔が1つだけ検出されていて、かつユーザーIDが入力されている場合のみボタンを有効化
    if (registerBtn) {
        const canRegister = isFaceDetected && isSingleFace && isUserIdEntered;
        registerBtn.disabled = !canRegister;
        
        // 登録ボタンが押せない理由を表示
        if (registerStatus) {
            let newStatusMessage = '';
            
            if (!canRegister) {
                if (!isFaceDetected) {
                    newStatusMessage = '顔が検出されていません。カメラに顔を映してください。';
                } else if (!isSingleFace) {
                    newStatusMessage = '複数の顔が検出されています。一人だけ映るようにしてください。';
                } else if (!isUserIdEntered) {
                    newStatusMessage = 'IDを入力してください。';
                }
            }
            
            // 前回のメッセージと異なる場合のみ更新
            if (newStatusMessage !== lastStatusMessage) {
                registerStatus.textContent = newStatusMessage;
                lastStatusMessage = newStatusMessage;
            }
        }
    }
}

// 顔情報を登録する関数
async function registerFace(event) {
    event.preventDefault();
    
    if (!stream) {
        alert('カメラが起動していません。カメラを起動してください。');
        return;
    }
    
    const userIdInput = document.getElementById('user-id');
    const userId = userIdInput.value.trim();
    
    if (!userId) {
        alert('IDを入力してください。');
        return;
    }
    
    // 登録処理中は登録ボタンを無効化
    registerBtn.disabled = true;
    registerStatus.textContent = '登録処理中...';
    
    try {
        // 顔を検出
        const detections = await faceapi.detectAllFaces(video)
            .withFaceLandmarks()
            .withFaceDescriptors();
        
        if (detections.length === 0) {
            alert('顔が検出されませんでした。正面を向いて再試行してください。');
            return;
        }
        
        if (detections.length > 1) {
            alert('複数の顔が検出されました。一人だけ映るようにしてください。');
            return;
        }
        
        // 検出された顔を取得
        const resizedDetections = faceapi.resizeResults(detections, {
            width: video.width,
            height: video.height
        });
        const detection = resizedDetections[0];
        
        // 顔特徴量を保存
        capturedFaceDescriptor = detection.descriptor;
        
        // Google Apps Scriptに保存
        saveRegisteredFaces(userId, Array.from(capturedFaceDescriptor));    
    } catch (error) {
        console.error('顔の登録に失敗しました:', error);
        alert('顔の登録に失敗しました。再試行してください。');
    }
}

// 登録済み顔情報をGoogle Apps Scriptに保存する関数
async function saveRegisteredFaces(memberId, descriptor) {
    try {
        const response = await fetch(findUrl, {
            method: 'POST',
            body: JSON.stringify({
                action: 'createFace',
                memberId: memberId,
                descriptor: JSON.stringify(descriptor)
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Google Apps Scriptへの保存結果:', result);

        // サーバーからエラーレスポンスが返ってきた場合
        if (result.error === true && result.message) {
            throw new Error(result.message);
        }

        alert(`ID "${result.id}" の顔情報が登録されました。`);

        capturedFaceDescriptor = null;         
    } catch (error) {
        console.error('Google Apps Scriptへの保存に失敗しました:', error);
        // エラーメッセージを表示（サーバーからのエラーメッセージがある場合はそれを表示）
        alert(`サーバーへの保存に失敗しました: ${error.message}`);
    } finally {
        // 登録処理が完了したらステータスメッセージをクリア
        registerStatus.textContent = '';
        lastStatusMessage = '';
        
        // 登録ボタンの状態を更新
        updateRegisterButtonState();
    }
}

// ページを離れる前にカメラを停止
window.addEventListener('beforeunload', () => {
    stopCamera();
});
