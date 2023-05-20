const socket = io();
const myFace = document.getElementById("myFace");
const videoBtn = document.getElementById("video");
const audioBtn = document.getElementById("audio");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");
const datachannelChat = document.getElementById("datachannelChat");

call.hidden = true;
datachannelChat.hidden = true;

let myStream;
let camera = false;
let mute = false;
let peerConnection;
let roomName;
let dataChannel;
async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((v) => v.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks[0];
    cameras.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.deviceId;
      option.innerText = item.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}
getCameras();

async function getMediea(deviceId) {
  const initConstrains = {
    audio: true,
    video: true
  };
  const cameraConstrains = {
    audio: true,
    video: { deviceId: { exact: deviceId } }
  };
  try {
    if (!deviceId) {
      await getCameras();
    }
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstrains : initConstrains
    );
    myFace.srcObject = myStream;
  } catch (e) {
    console.log(e);
  }
}

// getMediea();

const handleCameraClick = () => {
  myStream.getVideoTracks().forEach((item) => (item.enabled = !item.enabled));
  if (camera) {
    videoBtn.innerText = "Camera Off";
    camera = false;
  } else {
    videoBtn.innerText = "Camera On";
    camera = true;
  }
};
const handleAudioClick = () => {
  myStream.getAudioTracks().forEach((item) => (item.enabled = !item.enabled));
  if (mute) {
    audioBtn.innerText = "Mute";
    mute = false;
  } else {
    audioBtn.innerText = "UnMute";
    mute = true;
  }
};

const handleCameraChange = async (e) => {
  await getMediea(camerasSelect.value);
  // 다른 카메라로 전환해도 연결 지속되도록
  if (peerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = peerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
};

videoBtn.addEventListener("click", handleCameraClick);
audioBtn.addEventListener("click", handleAudioClick);
camerasSelect.addEventListener("input", handleCameraChange);

// welcome form
const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function startMedia() {
  welcome.hidden = true;
  call.hidden = false;
  datachannelChat.hidden = false;
  await getMediea();
  makeConnection();
}

const handleWelcomeForm = async (e) => {
  e.preventDefault();
  const input = welcomeForm.querySelector("input");
  const value = input.value;
  await startMedia();
  socket.emit("join_room", value);
  roomName = input.value;
  input.value = "";
};

welcomeForm.addEventListener("submit", handleWelcomeForm);

//socket code
const chatForm = document.getElementById("chatForm");
const ul = document.getElementById("chatList");

function chatFn(message) {
  const li = document.createElement("li");
  li.innerText = message;
  ul.appendChild(li);
  message = "";
}

const handleChatFormSubmit = (e) => {
  e.preventDefault();
  const input = chatForm.querySelector("input");
  const li = document.createElement("li");
  li.innerText = `You : ${input.value}`;
  ul.appendChild(li);
  if (dataChannel) {
    dataChannel.send(input.value);
  }
  input.value = "";
};

chatForm.addEventListener("submit", handleChatFormSubmit);

socket.on("welcome", async () => {
  // data channel
  dataChannel = peerConnection.createDataChannel("chat");
  dataChannel.addEventListener("message", (event) => {
    chatFn(event.data);
  });
  console.log("made data channel from peerA");

  const offer = await peerConnection.createOffer();
  peerConnection.setLocalDescription(offer);
  console.log("send the offer");
  socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => {
  // data channel
  peerConnection.addEventListener("datachannel", (event) => {
    dataChannel = event.channel;
    dataChannel.addEventListener("message", (event) => {
      chatFn(event.data);
    });
  });

  console.log("received the offer");
  peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  peerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
  console.log("send the answer");
});

socket.on("answer", (answer) => {
  console.log("recieved the answer");
  peerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  console.log("recieved candidate");
  peerConnection.addIceCandidate(ice);
});
// RTC code

function makeConnection() {
  // create peer to peer Connection
  peerConnection = new RTCPeerConnection();
  // myStream에 존재하는 track들을 peerConnection에 집어넣는다
  peerConnection.addEventListener("icecandidate", handleIcce);
  peerConnection.addEventListener("addstream", handleAddStream);
  myStream
    .getTracks()
    .forEach((track) => peerConnection.addTrack(track, myStream));
}
function handleIcce(data) {
  console.log("send candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  const peersStream = document.getElementById("peersStream");
  peersStream.srcObject = data.stream;
}
