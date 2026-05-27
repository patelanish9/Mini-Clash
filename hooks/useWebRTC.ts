"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────
   useWebRTC — Manage Peer-to-Peer Voice Chat via Websocket Signals
───────────────────────────────────────────────────────────── */

interface UseWebRTCOptions {
  socket: any; // Socket.io-client instance
  connected: boolean;
  gameMode: "local" | "online" | "bot";
  myRole: string | number | null;
  emitAction: (action: string, payload: any) => void;
}

export function useWebRTC({ socket, connected, gameMode, myRole, emitAction }: UseWebRTCOptions) {
  const [voiceActive, setVoiceActive] = useState(false);
  const [peerState, setPeerState] = useState<RTCPeerConnectionState>("new");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Clean up all tracks and connections
  const cleanUpWebRTC = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current.remove();
      audioElRef.current = null;
    }
    remoteStreamRef.current = null;
    setVoiceActive(false);
    setPeerState("new");
  }, []);

  const initWebRTC = useCallback(async () => {
    if (typeof window === "undefined" || !socket || gameMode !== "online" || !myRole) return;

    try {
      // 1. Get mic media stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // 2. Initialize P2P connection with STUN server
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      // 3. Track connection state
      pc.onconnectionstatechange = () => {
        setPeerState(pc.connectionState);
      };

      // 4. Send ICE Candidates as gathered to opponent
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          emitAction("webrtc_signal", {
            type: "candidate",
            candidate: event.candidate,
          });
        }
      };

      // 5. Receive remote audio tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];

          // Create dynamic hidden audio element to play voice chat stream
          if (!audioElRef.current) {
            const audio = document.createElement("audio");
            audio.autoplay = true;
            audio.style.display = "none";
            document.body.appendChild(audio);
            audioElRef.current = audio;
          }
          audioElRef.current.srcObject = event.streams[0];
        }
      };

      // 6. Attach local tracks to connection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 7. Role negotiation rules: Role X (or Role 1) starts calling
      const isCaller = myRole === "X" || myRole === 1;
      if (isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emitAction("webrtc_signal", {
          type: "offer",
          sdp: offer,
        });
      }

      setVoiceActive(true);
    } catch (err) {
      console.warn("[WebRTC Error] Mic access denied or connection block:", err);
      cleanUpWebRTC();
    }
  }, [socket, gameMode, myRole, emitAction, cleanUpWebRTC]);

  // Handle incoming signaling messages from server relay
  useEffect(() => {
    if (!socket || gameMode !== "online") return;

    const handleWebRTCSignal = async (payload: any) => {
      const pc = pcRef.current;

      try {
        if (payload.type === "offer") {
          // If receiver receives call offer, answer it!
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emitAction("webrtc_signal", {
            type: "answer",
            sdp: answer,
          });
        } else if (payload.type === "answer") {
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } else if (payload.type === "candidate") {
          if (!pc || !pc.remoteDescription) return;
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch (err) {
        // Signaling negotiation warning - ignore and continue
      }
    };

    socket.on("webrtc_signal", handleWebRTCSignal);

    return () => {
      socket.off("webrtc_signal", handleWebRTCSignal);
    };
  }, [socket, gameMode, emitAction]);

  // Handle auto connection closure when gameplay finishes
  useEffect(() => {
    if (gameMode !== "online") {
      cleanUpWebRTC();
    }
    return () => cleanUpWebRTC();
  }, [gameMode, cleanUpWebRTC]);

  const toggleVoiceChat = () => {
    if (voiceActive) {
      cleanUpWebRTC();
    } else {
      initWebRTC();
    }
  };

  return {
    voiceActive,
    peerState,
    toggleVoiceChat,
  };
}
