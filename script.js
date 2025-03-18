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

// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', async () => {
    // 要素の取得
    video = document.getElementById('video');
    overlay = document.getElementById('overlay');
    capturedFaceCanvas = document.getElementById('captured-face');
    registerBtn = document.getElementById('register-btn');
    userIdInput = document.getElementById('user-id');
    registerStatus = document.getElementById('register-status');
    
    // 初期状態では登録ボタンを無効化
    registerBtn.disabled = true;
    
    // ユーザーIDの入力状態を監視
    userIdInput.addEventListener('input', updateRegisterButtonState);
    
    const registerForm = document.getElementById('register-form');
    
    // face-api.jsのモデルを読み込む
    await loadModels();
    
    // イベントリスナーの設定
    registerForm.addEventListener('submit', registerFace);
    
    // ローカルストレージから登録済み顔情報を読み込む
    loadRegisteredFaces();
    
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
        // カメラへのアクセス許可を明示的に要求
        console.log('カメラへのアクセスを要求しています...');
        
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
        console.log('カメラストリームを取得しました:', stream);
        
        // ビデオ要素にストリームを設定
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            console.log('ビデオの再生を開始しました');
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
    }, 100);
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
            if (!canRegister) {
                let reason = '';
                if (!isFaceDetected) {
                    reason = '顔が検出されていません。カメラに顔を映してください。';
                } else if (!isSingleFace) {
                    reason = '複数の顔が検出されています。一人だけ映るようにしてください。';
                } else if (!isUserIdEntered) {
                    reason = 'IDを入力してください。';
                }
                registerStatus.textContent = reason;
            } else {
                registerStatus.textContent = '';
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
        const box = detection.detection.box;
        
        // 顔の領域をキャプチャ
        const ctx = capturedFaceCanvas.getContext('2d');
        ctx.clearRect(0, 0, capturedFaceCanvas.width, capturedFaceCanvas.height);
        
        // 顔の領域をビデオからキャプチャしてキャンバスに描画
        ctx.drawImage(
            video, 
            box.x, box.y, box.width, box.height,
            0, 0, capturedFaceCanvas.width, capturedFaceCanvas.height
        );
        
        // 顔特徴量を保存
        capturedFaceDescriptor = detection.descriptor;
        
        // 既存のIDをチェック
        const existingFace = registeredFaces.find(face => face.id === userId);
        if (existingFace) {
            if (!confirm(`ID "${userId}" は既に登録されています。上書きしますか？`)) {
                return;
            }
            // 既存の顔情報を削除
            registeredFaces = registeredFaces.filter(face => face.id !== userId);
        }
        
        // キャプチャした顔画像をデータURLとして取得
        const faceImageUrl = capturedFaceCanvas.toDataURL('image/png');
        
        // 新しい顔情報を登録
        const newFace = {
            id: userId,
            descriptor: Array.from(capturedFaceDescriptor),
            imageUrl: faceImageUrl,
            timestamp: new Date().toISOString()
        };
        
        registeredFaces.push(newFace);
        
        // Google Apps Scriptに保存
        saveRegisteredFaces(userId, Array.from(capturedFaceDescriptor));
        
        // 登録済み顔情報を更新
        updateRegisteredFacesList();
        
        // フォームをリセット
        userIdInput.value = '';
        ctx.clearRect(0, 0, capturedFaceCanvas.width, capturedFaceCanvas.height);
        capturedFaceDescriptor = null;
        
        alert(`ID "${userId}" の顔情報が登録されました。`);
        
    } catch (error) {
        console.error('顔の登録に失敗しました:', error);
        alert('顔の登録に失敗しました。再試行してください。');
    }
}

// 登録済み顔情報をGoogle Apps Scriptに保存する関数
async function saveRegisteredFaces(memberId, descriptor) {
    try {
        const response = await fetch('https://script.google.com/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'registerFace',
                memberId: memberId,
                descriptor: descriptor
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Google Apps Scriptへの保存結果:', result);
        
        // ローカルストレージにも保存（表示用）
        localStorage.setItem('registeredFaces', JSON.stringify(registeredFaces));
    } catch (error) {
        console.error('Google Apps Scriptへの保存に失敗しました:', error);
        alert('サーバーへの保存に失敗しました。ネットワーク接続を確認してください。');
        
        // エラー時もローカルには保存
        localStorage.setItem('registeredFaces', JSON.stringify(registeredFaces));
    }
}

// ローカルストレージから登録済み顔情報を読み込む関数
function loadRegisteredFaces() {
    const savedFaces = localStorage.getItem('registeredFaces');
    if (savedFaces) {
        registeredFaces = JSON.parse(savedFaces);
        updateRegisteredFacesList();
    }
}

// 登録済み顔情報リストを更新する関数
function updateRegisteredFacesList() {
    const facesList = document.getElementById('faces-list');
    facesList.innerHTML = '';
    
    if (registeredFaces.length === 0) {
        facesList.innerHTML = '<p>登録された顔情報はありません。</p>';
        return;
    }
    
    // 登録日時の新しい順にソート
    const sortedFaces = [...registeredFaces].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    // 各顔情報のカードを作成
    sortedFaces.forEach(face => {
        const faceCard = document.createElement('div');
        faceCard.className = 'face-card';
        
        const faceImage = document.createElement('img');
        faceImage.className = 'face-image';
        faceImage.src = face.imageUrl;
        faceImage.alt = `${face.id}の顔`;
        
        const faceId = document.createElement('div');
        faceId.className = 'face-id';
        faceId.textContent = face.id;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '削除';
        deleteBtn.addEventListener('click', () => deleteFace(face.id));
        
        faceCard.appendChild(faceImage);
        faceCard.appendChild(faceId);
        faceCard.appendChild(deleteBtn);
        
        facesList.appendChild(faceCard);
    });
}

// 顔情報を削除する関数
async function deleteFace(id) {
    if (confirm(`ID "${id}" の顔情報を削除しますか？`)) {
        // ローカル表示用の配列から削除
        registeredFaces = registeredFaces.filter(face => face.id !== id);
        
        try {
            // Google Apps Scriptに削除リクエストを送信
            const response = await fetch('https://script.google.com/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'deleteFace',
                    memberId: id
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // ローカルストレージも更新
            localStorage.setItem('registeredFaces', JSON.stringify(registeredFaces));
            updateRegisteredFacesList();
            alert(`ID "${id}" の顔情報が削除されました。`);
        } catch (error) {
            console.error('顔情報の削除に失敗しました:', error);
            alert('サーバーからの削除に失敗しました。ネットワーク接続を確認してください。');
            
            // エラー時もローカルストレージは更新
            localStorage.setItem('registeredFaces', JSON.stringify(registeredFaces));
            updateRegisteredFacesList();
        }
    }
}

// ページを離れる前にカメラを停止
window.addEventListener('beforeunload', () => {
    stopCamera();
});
