// --- DOM Elements ---
const imageLoader = document.getElementById('image-loader');
const difficultySelect = document.getElementById('difficulty');
const startButton = document.getElementById('start-button');
const canvas = document.getElementById('puzzle-canvas');
const ctx = canvas.getContext('2d');
const instructions = document.getElementById('instructions');
const difficultyContainer = document.getElementById('difficulty-container');
const puzzleContainer = document.getElementById('puzzle-container');
const winModal = document.getElementById('win-modal');
const playAgainButton = document.getElementById('play-again-button');
const generateIdeaButton = document.getElementById('generate-idea-button');
const generateImageButton = document.getElementById('generate-image-button');
const ideaContainer = document.getElementById('idea-container');
const ideaText = document.getElementById('idea-text');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');

// --- Game State ---
let puzzleImage = new Image();
let pieces = [];
let puzzleWidth, puzzleHeight;
let pieceWidth, pieceHeight;
let difficulty = 4;
let selectedPiece = null;
let dragOffsetX, dragOffsetY;
let isPuzzleActive = false;

// --- Event Listeners ---
imageLoader.addEventListener('change', handleImageUpload);
startButton.addEventListener('click', startPuzzle);
difficultySelect.addEventListener('change', (e) => difficulty = parseInt(e.target.value));
playAgainButton.addEventListener('click', resetGame);
generateIdeaButton.addEventListener('click', generateIdea);
generateImageButton.addEventListener('click', generateImageFromIdea);

canvas.addEventListener('mousedown', onMouseDown);
canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('mouseup', onMouseUp);

canvas.addEventListener('touchstart', onTouchStart, { passive: false });
canvas.addEventListener('touchmove', onTouchMove, { passive: false });
canvas.addEventListener('touchend', onTouchEnd);

// --- Gemini API Functions ---

/**
 * Shows or hides the loading overlay.
 * @param {boolean} show - Whether to show the overlay.
 * @param {string} text - The text to display.
 */
function setLoading(show, text = 'Generating...') {
    loadingText.textContent = text;
    loadingOverlay.classList.toggle('hidden', !show);
    loadingOverlay.classList.toggle('flex', show);
}

/**
 * Calls Gemini to generate a puzzle idea.
 */
async function generateIdea() {
    setLoading(true, '✨ Thinking of an idea...');
    generateIdeaButton.disabled = true;

    const prompt = "Describe a beautiful, detailed, and interesting image that would make a great jigsaw puzzle. Be creative and specific. Only return the description. For example: 'A vibrant coral reef teeming with colorful tropical fish and a hidden sea turtle.'";

    try {
        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };
        // !!! IMPORTANT !!! Replace with your actual Gemini API Key
        const apiKey = "YOUR_GEMINI_API_KEY";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            ideaText.textContent = text.trim();
            ideaContainer.classList.remove('hidden');
        } else {
            ideaText.textContent = "Sorry, I couldn't think of anything. Try again!";
        }
    } catch (error) {
        console.error("Error generating idea:", error);
        ideaText.textContent = `An error occurred: ${error.message}. Please check the console.`;
    } finally {
        setLoading(false);
        generateIdeaButton.disabled = false;
    }
}

/**
 * Calls Imagen to generate an image from the text idea.
 */
async function generateImageFromIdea() {
    const prompt = ideaText.textContent;
    if (!prompt) return;

    setLoading(true, '✨ Creating image...');
    generateImageButton.disabled = true;

    try {
        const payload = { instances: [{ prompt: prompt }], parameters: { "sampleCount": 1 } };
        // !!! IMPORTANT !!! Replace with your actual Imagen API Key
        const apiKey = "YOUR_IMAGEN_API_KEY";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            // Attempt to parse error response from API
            const errorData = await response.json().catch(() => null);
            const errorMessage = errorData?.error?.message || response.statusText;
            throw new Error(`API request failed with status ${response.status}: ${errorMessage}`);
        }

        const result = await response.json();
        if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
            puzzleImage.src = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
            puzzleImage.onload = () => {
                instructions.textContent = "AI image created! Select difficulty and start.";
                difficultyContainer.classList.remove('hidden');
                displayImagePreview();
                setLoading(false);
            }
        } else {
             throw new Error("No image data received from API.");
        }
    } catch (error) {
        console.error("Error generating image:", error);
        instructions.textContent = `Failed to create image: ${error.message}. Please try again.`;
        setLoading(false);
    } finally {
        generateImageButton.disabled = false;
    }
}


// --- Core Game Functions ---

function handleImageUpload(e) {
    if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = function(event) {
            puzzleImage.src = event.target.result;
            puzzleImage.onload = () => {
                instructions.textContent = "Image loaded! Select difficulty and start.";
                difficultyContainer.classList.remove('hidden');
                displayImagePreview();
            }
        }
        reader.readAsDataURL(e.target.files[0]);
    }
}

function displayImagePreview() {
    const containerRect = puzzleContainer.getBoundingClientRect();
    const maxW = containerRect.width * 0.95;
    const maxH = containerRect.height * 0.95;

    const aspectRatio = puzzleImage.width / puzzleImage.height;
    if (maxW / aspectRatio <= maxH) {
        puzzleWidth = maxW;
        puzzleHeight = maxW / aspectRatio;
    } else {
        puzzleHeight = maxH;
        puzzleWidth = maxH * aspectRatio;
    }

    canvas.width = puzzleWidth;
    canvas.height = puzzleHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(puzzleImage, 0, 0, puzzleWidth, puzzleHeight);
    ctx.globalAlpha = 1.0;
}

function startPuzzle() {
    if (!puzzleImage.src) {
        instructions.textContent = "Please upload or generate an image first!";
        return;
    }
    isPuzzleActive = true;
    difficulty = parseInt(difficultySelect.value);
    instructions.textContent = "Drag the pieces to solve the puzzle!";

    // Hide controls related to image selection/generation once puzzle starts
    difficultyContainer.classList.add('hidden');
    imageLoader.parentElement.classList.add('hidden');
    generateIdeaButton.parentElement.parentElement.classList.add('hidden'); // Hides the entire AI section
    ideaContainer.classList.add('hidden');


    setupPuzzle();
    shuffleAndPlacePieces();
    drawLoop();
}

function setupPuzzle() {
    pieces = [];
    pieceWidth = Math.floor(puzzleWidth / difficulty);
    pieceHeight = Math.floor(puzzleHeight / difficulty);

    for (let y = 0; y < difficulty; y++) {
        for (let x = 0; x < difficulty; x++) {
            const piece = {
                sx: x * pieceWidth, sy: y * pieceHeight, // Source X, Source Y on the original image
                x: 0, y: 0, // Current X, Current Y on the canvas
                correctX: x * pieceWidth, correctY: y * pieceHeight, // Correct X, Correct Y for placement
                isPlaced: false
            };
            pieces.push(piece);
        }
    }
}

function shuffleAndPlacePieces() {
    // Fisher-Yates shuffle algorithm
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]]; // Swap pieces
    }

    // Place shuffled pieces randomly on the canvas
    pieces.forEach(piece => {
        piece.x = Math.random() * (canvas.width - pieceWidth);
        piece.y = Math.random() * (canvas.height - pieceHeight);
        piece.isPlaced = false; // Ensure piece is not marked as placed initially
    });
}

function drawLoop() {
    if (!isPuzzleActive) return; // Stop drawing if puzzle is not active
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw a faded original image as a background hint
    ctx.globalAlpha = 0.15;
    ctx.drawImage(puzzleImage, 0, 0, puzzleWidth, puzzleHeight);
    ctx.globalAlpha = 1.0;

    // Draw the puzzle grid outline
    ctx.strokeStyle = '#A9A9A9'; // Dark grey
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, puzzleWidth, puzzleHeight);

    // Draw each puzzle piece
    pieces.forEach(piece => {
        ctx.save(); // Save current context state
        // Draw the image portion for this piece
        ctx.drawImage(puzzleImage, piece.sx, piece.sy, pieceWidth, pieceHeight, piece.x, piece.y, pieceWidth, pieceHeight);

        // Draw border for the piece
        ctx.strokeStyle = piece.isPlaced ? '#22c55e' : '#000000'; // Green if placed, black otherwise
        ctx.lineWidth = piece.isPlaced ? 3 : 1;
        ctx.strokeRect(piece.x, piece.y, pieceWidth, pieceHeight);
        ctx.restore(); // Restore context state
    });

    // Draw the currently selected piece on top with a highlight
    if (selectedPiece) {
        ctx.save();
        ctx.globalAlpha = 0.8; // Make selected piece slightly transparent
        ctx.drawImage(puzzleImage, selectedPiece.sx, selectedPiece.sy, pieceWidth, pieceHeight, selectedPiece.x, selectedPiece.y, pieceWidth, pieceHeight);
        ctx.strokeStyle = '#3b82f6'; // Blue highlight
        ctx.lineWidth = 3;
        ctx.strokeRect(selectedPiece.x, selectedPiece.y, pieceWidth, pieceHeight);
        ctx.restore();
    }
    requestAnimationFrame(drawLoop); // Loop indefinitely
}

function isPointInPiece(x, y, piece) {
    return x > piece.x && x < piece.x + pieceWidth && y > piece.y && y < piece.y + pieceHeight;
}

function handleInteractionStart(clientX, clientY) {
    if (!isPuzzleActive) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    // Iterate backwards to pick the top-most piece
    for (let i = pieces.length - 1; i >= 0; i--) {
        const piece = pieces[i];
        if (!piece.isPlaced && isPointInPiece(mouseX, mouseY, piece)) {
            selectedPiece = piece;
            dragOffsetX = mouseX - piece.x;
            dragOffsetY = mouseY - piece.y;
            // Move the selected piece to the end of the array to draw it on top
            pieces.splice(i, 1);
            pieces.push(selectedPiece);
            break;
        }
    }
}

function handleInteractionMove(clientX, clientY) {
    if (selectedPiece) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;
        selectedPiece.x = mouseX - dragOffsetX;
        selectedPiece.y = mouseY - dragOffsetY;
    }
}

function handleInteractionEnd() {
    if (selectedPiece) {
        const snapDistance = pieceWidth * 0.2; // 20% of piece width for snapping tolerance
        const dx = Math.abs(selectedPiece.x - selectedPiece.correctX);
        const dy = Math.abs(selectedPiece.y - selectedPiece.correctY);

        if (dx < snapDistance && dy < snapDistance) {
            selectedPiece.x = selectedPiece.correctX;
            selectedPiece.y = selectedPiece.correctY;
            selectedPiece.isPlaced = true;
        }
        selectedPiece = null;
        checkWinCondition();
    }
}

function onMouseDown(e) { handleInteractionStart(e.clientX, e.clientY); }
function onMouseMove(e) { handleInteractionMove(e.clientX, e.clientY); }
function onMouseUp() { handleInteractionEnd(); }
function onTouchStart(e) { e.preventDefault(); const t = e.touches[0]; handleInteractionStart(t.clientX, t.clientY); }
function onTouchMove(e) { e.preventDefault(); const t = e.touches[0]; handleInteractionMove(t.clientX, t.clientY); }
function onTouchEnd() { handleInteractionEnd(); }

function checkWinCondition() {
    if (pieces.every(p => p.isPlaced)) {
        isPuzzleActive = false;
        const modalContent = winModal.querySelector('div');
        winModal.classList.remove('hidden');
        // Trigger opacity and scale transition
        setTimeout(() => {
            winModal.classList.remove('opacity-0');
            modalContent.classList.remove('scale-95');
        }, 10); // Small delay for CSS transition to apply
    }
}

function resetGame() {
    isPuzzleActive = false;
    pieces = [];
    selectedPiece = null;

    // Reset modal state
    const modalContent = winModal.querySelector('div');
    winModal.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
    // Hide modal after transition
    setTimeout(() => winModal.classList.add('hidden'), 300);

    // Reset UI elements
    imageLoader.value = ''; // Clear file input
    imageLoader.parentElement.classList.remove('hidden'); // Show file input
    generateIdeaButton.parentElement.parentElement.classList.remove('hidden'); // Show AI section
    difficultyContainer.classList.add('hidden'); // Hide difficulty until new image is loaded/generated
    ideaContainer.classList.add('hidden'); // Hide idea box
    instructions.textContent = "Upload an image, or let AI create one for you!";
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
    canvas.width = 0; // Reset canvas dimensions
    canvas.height = 0;
    puzzleImage = new Image(); // Reset the puzzle image object
}
function checkWinCondition() {
    // This line checks if EVERY piece in the 'pieces' array has its 'isPlaced' property set to true.
    if (pieces.every(p => p.isPlaced)) {
        isPuzzleActive = false; // Stop the game loop
        const modalContent = winModal.querySelector('div');
        winModal.classList.remove('hidden'); // Make the modal visible
        // Adds a slight delay to allow the 'hidden' class removal to register before
        // the opacity and scale transitions begin, ensuring the animation plays.
        setTimeout(() => {
            winModal.classList.remove('opacity-0'); // Fade in
            modalContent.classList.remove('scale-95'); // Scale up
        }, 10);
    }
}
const confettiContainer = document.getElementById('confetti-container');
function getRandomColor() {
    const colors = ['#FFC107', '#E91E63', '#9C27B0', '#2196F3', '#00BCD4', '#8BC34A', '#FF5722'];
    return colors[Math.floor(Math.random() * colors.length)];
}
function launchConfetti() {
    const numberOfConfetti = 100; // How many pieces of confetti
    const containerRect = confettiContainer.getBoundingClientRect();

    for (let i = 0; i < numberOfConfetti; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');

        // Randomize shape
        if (Math.random() < 0.3) { // 30% chance of square
            confetti.classList.add('square');
        } else if (Math.random() < 0.6) { // 30% chance of triangle
             confetti.classList.add('triangle');
        }


        const startX = Math.random() * containerRect.width;
        const startY = Math.random() * containerRect.height / 2; // Start higher up
        const endX = Math.random() * containerRect.width * 1.5 - (containerRect.width * 0.25); // Wider spread
        const endY = containerRect.height + 50; // Fall off screen

        confetti.style.setProperty('--x-start', `${startX}px`);
        confetti.style.setProperty('--y-start', `${startY}px`);
        confetti.style.setProperty('--x-end', `${endX}px`);
        confetti.style.setProperty('--y-end', `${endY}px`);
        confetti.style.backgroundColor = getRandomColor();
        confetti.style.animationDelay = `${Math.random() * 0.5}s`; // Stagger animation
        confetti.style.animationDuration = `${2 + Math.random() * 2}s`; // Vary duration

        confettiContainer.appendChild(confetti);

        // Remove confetti after animation to prevent DOM bloat
        confetti.addEventListener('animationend', () => {
            confetti.remove();
        });
    }
}
function checkWinCondition() {
    if (pieces.every(p => p.isPlaced)) {
        isPuzzleActive = false;
        const modalContent = winModal.querySelector('div');
        winModal.classList.remove('hidden');
        setTimeout(() => {
            winModal.classList.remove('opacity-0');
            modalContent.classList.remove('scale-95');
        }, 10);

        // NEW: Launch confetti when the puzzle is solved!
        launchConfetti();
    }
}
function resetGame() {
    // ... existing code ...

    // NEW: Clear any remaining confetti
    confettiContainer.innerHTML = ''; // Remove all child elements

    puzzleImage = new Image();
}
