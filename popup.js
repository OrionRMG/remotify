// API URLs
const PLAYER = "https://api.spotify.com/v1/me/player?additional_types=episode";
const PLAY = "https://api.spotify.com/v1/me/player/play";
const PAUSE = "https://api.spotify.com/v1/me/player/pause";
const SEEK = "https://api.spotify.com/v1/me/player/seek";
const SKIP_FORWARD = "https://api.spotify.com/v1/me/player/next";
const SKIP_BACK = "https://api.spotify.com/v1/me/player/previous";
const SHUFFLE = "https://api.spotify.com/v1/me/player/shuffle";
const REPEAT = "https://api.spotify.com/v1/me/player/repeat";
const QUEUE = "https://api.spotify.com/v1/me/player/queue";
const VOLUME = "https://api.spotify.com/v1/me/player/volume";

// Get elements from the DOM
const albumArt = document.querySelector(".album-art");
const authButtonContainer = document.querySelector(".auth-button-container");
const authButton = document.querySelector(".auth-button");
const errorContainer = document.querySelector(".error-container");
const retryButton = document.querySelector(".retry-button");
const playArea = document.querySelector(".play-area");
const songInfo = document.querySelector(".song-info");
const songTitle = document.querySelector(".song-title");
const songArtist = document.querySelector(".song-artist");
const toggleShuffle = document.querySelector(".toggle-shuffle");
const skipBack = document.querySelector(".skip-back");
const playButton = document.querySelector(".play-button");
const skipForward = document.querySelector(".skip-forward");
const toggleRepeat = document.querySelector(".toggle-repeat");
const currentTime = document.querySelector(".current-time");
const totalDuration = document.querySelector(".total-duration");
const seekSlider = document.querySelector(".seek-slider");
const volumeButton = document.querySelector(".volume-button");
const volumeSlider = document.querySelector(".volume-slider");
const logoutButton = document.querySelector(".logout");
const queueContainer = document.querySelector(".queue-container");
const queueControl = document.querySelector(".queue-control");
const queueControlText = document.querySelector(".queue-control-text");
const queueExpandIcon = document.querySelector(".queue-expand-icon");
const queueList = document.querySelector(".queue-list");
const queueListItems = document.querySelector(".queue-list-items");

let playing;
let isShuffled;
let currentRepeatMode;
let timers = [];
let seekBuffer;
let skipBuffer;
let volumeBuffer;
let prevVolume;
let muted;
let queueShown;

async function generateCodeVerifier() {
  let codeVerifier = generateRandomString(128);
  await chrome.storage.local.set({ code_verifier: codeVerifier });
}

generateCodeVerifier();

function generateRandomString(length) {
  let text = "";
  let possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Make an API call
async function callApi(method, url, body, callback) {
  const access_token_obj = await chrome.storage.local.get(["access_token"]);
  const access_token = access_token_obj.access_token;

  let response = await fetch(url, {
    method: method,
    headers: {
      Authorization: "Bearer " + access_token,
      "Content-Type": "application/json",
    },
    body: body,
    json: true,
  });
  if (callback) {
    callback(await handleApiResponse(response));
  }
}

// Get and handle API response data
async function handleApiResponse(response) {
  if (response.status == 200) {
    const jsonResponse = await response.json();
    return { data: jsonResponse, status: response.status };
  } else if (response.status == 204) {
    return response.status;
  } else if (response.status == 401) {
    // refreshAccessToken();
    chrome.runtime.sendMessage("REFRESH ACCESS TOKEN");
  } else {
    throw new Error(
      `Request failed! Status code: ${response.status} ${response.statusText}`
    );
  }
}

// Get current state of user's Spotify playback
async function getContext(callback) {
  try {
    await callApi("GET", PLAYER, null, callback);
  } catch (err) {
    console.log(err);
  }
}

//////////// API calls ////////////

function togglePlay() {
  try {
    if (!playing) {
      callApi("PUT", PLAY, null);
      playing = true;
      playButton.innerHTML = "pause";
      timers.push(setInterval(updateSlider, 1000));
    } else if (playing) {
      callApi("PUT", PAUSE, null);
      playing = false;
      playButton.innerHTML = "play_arrow";
      clearTimers();
    }
  } catch (err) {
    console.log(err);
  }
}

function seekTo(time) {
  try {
    callApi("PUT", SEEK + `?position_ms=${time}`, null);

    if (playing) {
      timers.push(setInterval(updateSlider, 1000));
    }

    currentTime.innerHTML = convertTime(time);
  } catch (err) {
    console.log(err);
  }
}

function setVolume(volume) {
  try {
    callApi("PUT", VOLUME + `?volume_percent=${volume}`, null);
  } catch (err) {
    console.log(err);
  }
}

function skipSong() {
  try {
    clearTimers();
    clearTimeout(skipBuffer);
    callApi("POST", SKIP_FORWARD, null);
    skipBuffer = setTimeout(() => {
      getContext(updatePopup);
    }, 1500);
  } catch (err) {
    console.log(err);
  }
}

function skipSongBack() {
  try {
    clearTimers();
    clearTimeout(skipBuffer);
    callApi("POST", SKIP_BACK, null);
    setTimeout(() => {
      getContext(updatePopup);
    }, 1500);
  } catch (err) {
    console.log(err);
  }
}

function shuffle(state) {
  try {
    callApi("PUT", SHUFFLE + `?state=${state}`, null);
    if (isShuffled === false) {
      isShuffled = true;
      toggleShuffle.style.color = "#49cc56";
    } else {
      isShuffled = false;
      toggleShuffle.style.color = "#FFF";
    }
  } catch (err) {
    console.log(err);
  }
}

function changeRepeatMode(state) {
  try {
    callApi("PUT", REPEAT + `?state=${state}`, null);

    currentRepeatMode = state;

    if (state === "off") {
      toggleRepeat.innerHTML = "repeat";
      toggleRepeat.style.color = "#FFF";
    } else if (state === "context") {
      toggleRepeat.style.color = "#49cc56";
    } else if (state === "track") {
      toggleRepeat.innerHTML = "repeat_one";
    }
  } catch (err) {
    console.log(err);
  }
}

function getQueue() {
  try {
    callApi("GET", QUEUE, null, handleQueue);
  } catch (err) {
    console.log(err);
  }
}

function handleQueue(response) {
  const queueData = response;
  const queue = queueData.data.queue;
  queue.length = 6;

  queueListItems.innerHTML = "";

  if (queue) {
    console.log(queue);
    queue.forEach((item) => {
      const imgUrl = item.album.images[2].url;
      const title = item.name;
      let artists = [];
      const artistList = item.artists;
      artistList.forEach((artist) => {
        artists.push(
          `<a href="${artist.external_urls.spotify}" target="_blank">${artist.name}</a>`
        );
      });

      const queueItemContent = `<div class="album-thumb" style="background-image: url('${imgUrl}')"></div>
      <div class="queue-item-info">
        <div class="queue-item-title"><a href="${
          item.external_urls.spotify
        }" target=_blank>${title}</a></div>
        <div class="queue-item-artist">${artists.join(", ")}</div>
      </div>`;

      const queueItem = document.createElement("div");
      queueItem.className = "queue-item";
      queueItem.innerHTML = queueItemContent;
      queueListItems.appendChild(queueItem);
    });
  }

  queueList.style.display = "flex";
}

function clearQueue() {
  queueList.style.display = "none";
  queueListItems.innerHTML = "";
}

///////////////////// UI Functionality /////////////////////

//Check if user is already authenticated and modify DOM accordingly
async function checkIfAuthenticated() {
  const isAccessTokenObj = await chrome.storage.local.get(["access_token"]);
  const isAccessToken = isAccessTokenObj.access_token;

  if (!!isAccessToken) {
    authButtonContainer.style.display = "none";

    getContext(updatePopup);
  } else {
    authButtonContainer.style.display = "flex";
    playArea.style.alignItems = "center";
    songInfo.style.display = "none";
    logoutButton.style.display = "none";
    albumArt.style.backgroundImage = "none";
    errorContainer.style.display = "none";
    console.log("Access token not found.");
  }
}

function clearTimers() {
  timers.forEach((timer) => {
    clearInterval(timer);
  });

  timers = [];
}

// Populate popup with current playback state
function updatePopup(response) {
  if (response === 204) {
    playArea.style.alignItems = "center";
    logoutButton.style.display = "block";
    errorContainer.style.display = "block";
  } else if (typeof response === "object") {
    playArea.style.alignItems = "flex-start";
    songInfo.style.display = "block";
    errorContainer.style.display = "none";
    logoutButton.style.display = "initial";

    let artists = [];
    const artistList = response.data.item.artists;
    const show = response.data.item.show;
    if (artistList) {
      artistList.forEach((artist) => {
        artists.push(
          "<a href=" + artist.uri + " target=_blank>" + artist.name + "</a>"
        );
      });
      let albumArtUrl = response.data.item.album.images[1].url;
      albumArt.style.backgroundImage = `url(${albumArtUrl})`;
    } else if (show) {
      artists.push(
        "<a href=" + show.uri + " target=_blank>" + show.name + "</a>"
      );
      let albumArtUrl = response.data.item.images[1].url;
      albumArt.style.backgroundImage = `url(${albumArtUrl})`;
    }

    songTitle.innerHTML =
      "<a href=" +
      response.data.item.uri +
      " target=_blank>" +
      response.data.item.name +
      "</a>";
    songArtist.innerHTML = artists.join(", ");

    currentTime.innerHTML = convertTime(response.data.progress_ms);

    seekSlider.setAttribute("max", response.data.item.duration_ms);
    seekSlider.setAttribute("value", response.data.progress_ms);
    const timeProgress =
      100 *
      (Number(seekSlider.getAttribute("value")) /
        Number(seekSlider.getAttribute("max")));
    seekSlider.style.background = `linear-gradient(to right, #49cc56 ${timeProgress}%, #444 ${timeProgress}%)`;
    totalDuration.innerHTML = convertTime(response.data.item.duration_ms);

    volumeSlider.setAttribute("value", response.data.device.volume_percent);
    const progress = volumeSlider.getAttribute("value");
    volumeSlider.style.background = `linear-gradient(to right, #49cc56 ${progress}%, #444 ${progress}%)`;

    if (response.data.is_playing === false) {
      playing = false;
      playButton.innerHTML = "play_arrow";
    } else if (response.data.is_playing === true) {
      playing = true;
      playButton.innerHTML = "pause";
      timers.push(setInterval(updateSlider, 1000));
    }

    if (response.data.shuffle_state === false) {
      isShuffled = false;
      toggleShuffle.style.color = "#FFF";
    } else if (response.data.shuffle_state === true) {
      isShuffled = true;
      toggleShuffle.style.color = "#49cc56";
    }

    if (response.data.repeat_state === "off") {
      currentRepeatMode = "off";
      toggleRepeat.innerHTML = "repeat";
      toggleRepeat.style.color = "#FFF";
    } else if (response.data.repeat_state === "context") {
      currentRepeatMode = "context";
      toggleRepeat.style.color = "#49cc56";
    } else if (response.data.repeat_state === "track") {
      currentRepeatMode = "track";
      toggleRepeat.innerHTML = "repeat_one";
      toggleRepeat.style.color = "#49cc56";
    }

    if (queueShown) {
      getQueue();
    }

    if (response.data.device.volume_percent === 0) {
      muted = true;
    } else {
      muted = false;
    }
  }
}

// Make timeline seek slider move
function updateSlider() {
  let maxDuration = Number(seekSlider.getAttribute("max"));
  let currentPosition = Number(seekSlider.getAttribute("value"));

  if (currentPosition < maxDuration) {
    currentPosition += 1000;
    currentTime.innerHTML = convertTime(seekSlider.getAttribute("value"));
    const timeProgress =
      100 * (currentPosition / Number(seekSlider.getAttribute("max")));
    seekSlider.style.background = `linear-gradient(to right, #49cc56 ${timeProgress}%, #444 ${timeProgress}%)`;
    seekSlider.setAttribute("value", currentPosition);
  } else {
    clearTimers();
    setTimeout(getContext(updatePopup), 1000);
  }
}

///////// Event Listeners /////////

seekSlider.addEventListener("input", (event) => {
  const time = Number(event.target.value);

  event.preventDefault();

  clearTimeout(seekBuffer);
  clearTimers();

  const timeProgress = 100 * (time / seekSlider.getAttribute("max"));
  seekSlider.style.background = `linear-gradient(to right, #49cc56 ${timeProgress}%, #444 ${timeProgress}%)`;
  seekSlider.setAttribute("value", time);

  seekBuffer = setTimeout(() => {
    seekTo(time);
  }, 500);
});

// Convert milliseconds to m:ss
function convertTime(ms) {
  var minutes = Math.floor(ms / 60000);
  var seconds = ((ms % 60000) / 1000).toFixed(0);
  return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
}

volumeSlider.addEventListener("input", (event) => {
  const volume = Number(event.target.value);
  changeVolume(volume);
});

function changeVolume(volume) {
  clearTimeout(volumeBuffer);

  volumeSlider.style.background = `linear-gradient(to right, #49cc56 ${volume}%, #444 ${volume}%)`;
  volumeSlider.setAttribute("value", volume);

  if (volume === 0) {
    volumeButton.innerHTML = "volume_off";
    muted = true;
  } else {
    volumeButton.innerHTML = "volume_up";
    muted = false;
  }

  volumeBuffer = setTimeout(() => {
    setVolume(volume);
  }, 200);
}

volumeButton.addEventListener("click", () => {
  if (!muted) {
    prevVolume = volumeSlider.getAttribute("value");
    changeVolume(0);
    muted = true;
  } else if (muted) {
    changeVolume(prevVolume);
  }
});

//Handle initial authorization
authButton.addEventListener("click", async () => {
  try {
    // const resUrl = await chrome.identity.launchWebAuthFlow(WebAuthFlowDetails);

    // const code = getCode(resUrl);

    // fetchAccessToken(code);

    const codeVerifierObj = await chrome.storage.local.get(["code_verifier"]);
    const codeVerifier = codeVerifierObj.code_verifier;

    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);

    await chrome.storage.session.set({ digest });

    chrome.runtime.sendMessage("GET ACCESS TOKEN");
  } catch (err) {
    console.log(err);
  }
});

retryButton.addEventListener("click", async () => {
  getContext(updatePopup);
});

playButton.addEventListener("click", () => {
  togglePlay();
});

skipForward.addEventListener("click", () => {
  skipSong();
});

skipBack.addEventListener("click", () => {
  skipSongBack();
});

toggleShuffle.addEventListener("click", () => {
  shuffle(!isShuffled);
});

toggleRepeat.addEventListener("click", () => {
  let nextRepeatMode;

  if (currentRepeatMode === "off") {
    nextRepeatMode = "context";
  } else if (currentRepeatMode === "context") {
    nextRepeatMode = "track";
  } else {
    nextRepeatMode = "off";
  }

  changeRepeatMode(nextRepeatMode);
});

queueControl.addEventListener("click", () => {
  if (!queueShown) {
    queueShown = true;
    queueExpandIcon.innerHTML = "expand_less";
    queueControlText.innerHTML = "Hide queue";
    getQueue();
  } else if (queueShown) {
    queueShown = false;
    queueExpandIcon.innerHTML = "expand_more";
    queueControlText.innerHTML = "Show queue";
    clearQueue();
  }
});

logoutButton.addEventListener("click", async () => {
  await chrome.storage.local.clear();

  checkIfAuthenticated();
});

checkIfAuthenticated();

chrome.runtime.onMessage.addListener((request) => {
  if (request === "REFRESH") checkIfAuthenticated();
});
