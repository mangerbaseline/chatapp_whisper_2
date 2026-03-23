"use client";

import { useState, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  endCall,
  acceptCall,
  toggleMute,
  setActiveMainView,
} from "@/redux/features/chat/callSlice";
import { motion } from "motion/react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useSocket } from "@/components/SocketProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  PhoneOff,
  PhoneCall,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  MonitorX,
  ChevronUp,
  ChevronDown,
  Monitor,
  Maximize,
  Minimize,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const gradients = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-orange-400 to-rose-500",
  "from-pink-500 to-fuchsia-500",
  "from-indigo-500 to-blue-600",
  "from-amber-400 to-orange-500",
  "from-cyan-400 to-blue-500",
];

function getGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

export function CallOverlay() {
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const {
    status,
    conversationId,
    participants,
    isMuted,
    isVideo,
    isGroup,
    errorMessage,
    isScreenSharing,
    activeMainView,
  } = useAppSelector((state) => state.call);

  const currentUser = useAppSelector((state: any) => state.auth.user);

  const {
    cleanup,
    startScreenShare,
    stopScreenShare,
    remoteStreams,
    remoteScreenStreams,
    localStream,
    localScreenStream,
    startLocalMedia,
  } = useWebRTC();

  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showPipTray, setShowPipTray] = useState(true);
  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const primaryParticipant = participants[0];
  const isScreenShareSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getDisplayMedia;

  useEffect(() => {
    if (status === "receiving") {
      const audio = new Audio("/ring.mp3");
      audio.loop = true;
      audio.volume = 0.8;
      audio.play().catch(() => {});
      ringAudioRef.current = audio;
    } else {
      if (ringAudioRef.current) {
        ringAudioRef.current.pause();
        ringAudioRef.current.currentTime = 0;
        ringAudioRef.current = null;
      }
    }
    return () => {
      if (ringAudioRef.current) {
        ringAudioRef.current.pause();
        ringAudioRef.current.currentTime = 0;
        ringAudioRef.current = null;
      }
    };
  }, [status]);

  useEffect(() => {
    if (
      activeMainView === "screen" &&
      !isScreenSharing &&
      Object.keys(remoteScreenStreams).length === 0
    ) {
      dispatch(setActiveMainView("remote"));
    }
  }, [isScreenSharing, remoteScreenStreams, activeMainView, dispatch]);

  if (status === "idle") return null;

  const handleEndCall = () => {
    if (socket && conversationId) {
      socket.emit("call:leave", { conversationId });

      if (!isGroup && participants[0]) {
        socket.emit("call:end", { to: participants[0].id });
      }
    }
    cleanup();
    dispatch(endCall());
  };

  const handleAcceptCall = async () => {
    if (socket && conversationId) {
      socket.emit("join_conversation", { conversationId });

      socket.emit("call:accept", {
        conversationId,
        callerId: participants[0]?.id,
        receiverInfo: {
          name: currentUser?.firstName || currentUser?.email || "User",
          image: currentUser?.image,
        },
      });
      dispatch(acceptCall());
      await startLocalMedia();

      socket.emit("call:join", {
        conversationId,
        userInfo: {
          name: currentUser?.firstName || currentUser?.email || "User",
          image: currentUser?.image,
        },
      });
    }
  };

  const handleRejectCall = () => {
    if (socket && conversationId) {
      socket.emit("call:reject", {
        conversationId,
        callerId: participants[0]?.id,
      });
    }
    dispatch(endCall());
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isCameraOff;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  const toggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
      if (activeMainView === "screen") dispatch(setActiveMainView("remote"));
    } else {
      startScreenShare();
      dispatch(setActiveMainView("screen"));
    }
  };

  const renderMainView = () => {
    if (activeMainView === "screen") {
      const screenStream = isScreenSharing
        ? localScreenStream
        : Object.values(remoteScreenStreams)[0];
      if (screenStream) {
        return (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video
              autoPlay
              playsInline
              muted
              draggable={false}
              className="absolute inset-0 w-full h-full object-contain"
              ref={(el) => {
                if (el && screenStream && el.srcObject !== screenStream) {
                  el.srcObject = screenStream;
                }
              }}
            />
          </div>
        );
      }
    }

    if (activeMainView === "local") {
      const hasLocalVideo =
        localStream && localStream.getVideoTracks().some((t) => t.enabled);
      const showLocalAvatar = !isVideo || isCameraOff || !hasLocalVideo;
      return (
        <div className="relative w-full h-full flex items-center justify-center bg-muted">
          <video
            autoPlay
            playsInline
            muted
            draggable={false}
            className={cn(
              "absolute inset-0 w-full h-full object-contain",
              showLocalAvatar && "hidden",
            )}
            ref={(el) => {
              if (el && el.srcObject !== localStream)
                el.srcObject = localStream;
            }}
          />
          {showLocalAvatar && (
            <AvatarFallbackUI
              name={currentUser?.firstName || "You"}
              image={currentUser?.image}
            />
          )}
        </div>
      );
    }

    const focusedId =
      activeMainView === "remote" || !activeMainView
        ? primaryParticipant?.id
        : activeMainView;
    const stream = remoteStreams[focusedId];
    const participant = participants.find((p) => p.id === focusedId);
    const hasVideoTrack = stream && stream.getVideoTracks().length > 0;

    return (
      <div className="relative w-full h-full flex items-center justify-center bg-muted">
        <video
          autoPlay
          playsInline
          draggable={false}
          className={cn(
            "absolute inset-0 w-full h-full object-contain",
            !hasVideoTrack && "opacity-0 pointer-events-none",
          )}
          ref={(el) => {
            if (el && stream && el.srcObject !== stream) {
              console.log(
                "[CallOverlay] Attaching stream to main video",
                focusedId,
              );
              el.srcObject = stream;
            }
          }}
        />
        {!hasVideoTrack && (
          <AvatarFallbackUI
            name={participant?.name || "Partner"}
            image={participant?.image}
          />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      {status === "ongoing" &&
        Object.entries(remoteStreams).map(([userId, stream]) => (
          <audio
            key={`audio-${userId}-${stream.id}`}
            autoPlay
            playsInline
            muted={false}
            ref={(el) => {
              if (el) {
                if (el.srcObject !== stream) {
                  console.log(
                    `[CallOverlay] Attaching stream to audio element for ${userId}`,
                    stream.getAudioTracks().length,
                    "audio tracks",
                  );
                  el.srcObject = stream;
                }
                el.volume = 1;
                el.play().catch((err) =>
                  console.error(
                    `[CallOverlay] Audio play failed for ${userId}:`,
                    err,
                  ),
                );
              }
            }}
          />
        ))}

      <Card
        ref={containerRef}
        className={cn(
          "relative w-full overflow-hidden shadow-2xl bg-background border-border/40 flex flex-col items-center justify-center transition-all duration-300",
          isFullScreen
            ? "h-full max-w-none rounded-none"
            : "max-w-4xl aspect-video rounded-3xl",
        )}
      >
        {isVideo && status === "ongoing" && renderMainView()}

        {(!isVideo || status !== "ongoing") && (
          <div className="flex flex-col items-center gap-6 z-0">
            <div
              className={cn(
                "relative",
                (status === "calling" || status === "receiving") &&
                  "animate-pulse",
              )}
            >
              <div
                className={cn(
                  "absolute -inset-3 rounded-full opacity-0 transition-opacity duration-500",
                  (status === "calling" || status === "receiving") &&
                    "opacity-100 animate-ping bg-primary/20",
                )}
              />
              <AvatarFallbackUI
                name={primaryParticipant?.name || "User"}
                image={primaryParticipant?.image}
              />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-2xl font-bold text-foreground tracking-tight">
                {primaryParticipant?.name || "User"}
              </h3>
              <p
                className={cn(
                  "text-sm font-medium flex items-center gap-2 justify-center",
                  status === "ongoing"
                    ? "text-green-500"
                    : "text-primary animate-pulse",
                )}
              >
                {status === "calling" && (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    Calling...
                  </>
                )}
                {status === "receiving" && (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    Incoming call...
                  </>
                )}
                {status === "ongoing" && "Connected"}
                {status !== "calling" &&
                  status !== "receiving" &&
                  status !== "ongoing" &&
                  "Call ended"}
              </p>
            </div>
          </div>
        )}

        {/* PIP tray */}
        {isVideo && status === "ongoing" && (
          <motion.div
            drag
            dragConstraints={containerRef}
            dragMomentum={false}
            className="absolute right-4 top-4 z-40 flex flex-col items-end gap-2"
          >
            <div className="bg-background/70 backdrop-blur-xl border border-border/40 p-2 rounded-2xl flex flex-col gap-2 shadow-xl transition-all duration-300 min-w-32">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPipTray(!showPipTray);
                }}
                variant="ghost"
                size="icon"
                className="h-6 w-full rounded-lg hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {showPipTray ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              {(() => {
                const availablePips = [];
                if (activeMainView !== "local") {
                  availablePips.push(
                    <div
                      key="local"
                      onClick={() => dispatch(setActiveMainView("local"))}
                      className="relative w-32 aspect-video rounded-xl bg-muted border-2 border-transparent hover:border-primary/50 cursor-pointer overflow-hidden transition-colors shadow-md group shrink-0"
                    >
                      <video
                        autoPlay
                        playsInline
                        muted
                        draggable={false}
                        className={cn(
                          "absolute inset-0 w-full h-full object-cover transform -scale-x-100",
                          (!localStream ||
                            isCameraOff ||
                            localStream.getVideoTracks().length === 0) &&
                            "hidden",
                        )}
                        ref={(el) => {
                          if (el && el.srcObject !== localStream)
                            el.srcObject = localStream;
                        }}
                      />
                      {(!localStream ||
                        isCameraOff ||
                        localStream.getVideoTracks().length === 0) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                          <AvatarFallbackUI
                            name={currentUser?.firstName || "You"}
                            image={currentUser?.image}
                            size="small"
                          />
                        </div>
                      )}
                    </div>,
                  );
                }

                participants.forEach((participant) => {
                  if (!participant.isJoined) return;
                  const focusedId =
                    activeMainView === "remote" || !activeMainView
                      ? primaryParticipant?.id
                      : activeMainView;
                  if (participant.id !== focusedId) {
                    const stream = remoteStreams[participant.id];
                    const hasVideo =
                      stream && stream.getVideoTracks().some((t) => t.enabled);
                    availablePips.push(
                      <div
                        key={participant.id}
                        onClick={() =>
                          dispatch(setActiveMainView(participant.id))
                        }
                        className="relative w-32 aspect-video rounded-xl bg-muted border-2 border-transparent hover:border-primary/50 cursor-pointer overflow-hidden transition-colors shadow-md group shrink-0"
                      >
                        {hasVideo && (
                          <video
                            autoPlay
                            playsInline
                            muted
                            draggable={false}
                            className="absolute inset-0 w-full h-full object-cover"
                            ref={(el) => {
                              if (el && stream && el.srcObject !== stream)
                                el.srcObject = stream;
                            }}
                          />
                        )}
                        {!hasVideo && (
                          <div className="absolute inset-0 flex items-center justify-center bg-muted">
                            <AvatarFallbackUI
                              name={participant.name}
                              image={participant.image}
                              size="small"
                            />
                          </div>
                        )}
                      </div>,
                    );
                  }
                });

                if (
                  activeMainView !== "screen" &&
                  (isScreenSharing ||
                    Object.keys(remoteScreenStreams).length > 0)
                ) {
                  availablePips.push(
                    <div
                      key="screen"
                      onClick={() => dispatch(setActiveMainView("screen"))}
                      className="relative w-32 aspect-video rounded-xl bg-primary/10 border-2 border-primary/40 cursor-pointer overflow-hidden transition-colors shadow-lg group flex items-center justify-center shrink-0"
                    >
                      <Monitor className="h-6 w-6 text-primary" />
                    </div>,
                  );
                }

                return showPipTray ? availablePips : availablePips.slice(0, 1);
              })()}
            </div>
          </motion.div>
        )}

        {/* Controls */}
        <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-4 z-20 px-8">
          <div className="flex items-center gap-3 bg-background/70 backdrop-blur-xl p-3.5 rounded-full border border-border/40 shadow-xl">
            {status === "receiving" ? (
              <>
                <Button
                  onClick={handleAcceptCall}
                  className="rounded-full h-14 w-14 bg-green-500 hover:bg-green-600 shadow-lg cursor-pointer hover:scale-105 transition-transform"
                >
                  <PhoneCall className="h-6 w-6 text-white" />
                </Button>
                <Button
                  onClick={handleRejectCall}
                  variant="destructive"
                  className="rounded-full h-14 w-14 shadow-lg cursor-pointer hover:scale-105 transition-transform"
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => dispatch(toggleMute())}
                  variant={isMuted ? "destructive" : "secondary"}
                  className="rounded-full h-11 w-11 cursor-pointer hover:scale-105 transition-transform"
                >
                  {isMuted ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>

                {isVideo && (
                  <Button
                    onClick={toggleCamera}
                    variant={isCameraOff ? "destructive" : "secondary"}
                    className="rounded-full h-11 w-11 cursor-pointer hover:scale-105 transition-transform"
                  >
                    {isCameraOff ? (
                      <VideoOff className="h-5 w-5" />
                    ) : (
                      <VideoIcon className="h-5 w-5" />
                    )}
                  </Button>
                )}

                {status === "ongoing" && isVideo && isScreenShareSupported && (
                  <Button
                    onClick={toggleScreenShare}
                    variant={isScreenSharing ? "destructive" : "secondary"}
                    className="rounded-full h-11 w-11 cursor-pointer hover:scale-105 transition-transform"
                  >
                    {isScreenSharing ? (
                      <MonitorX className="h-5 w-5" />
                    ) : (
                      <MonitorUp className="h-5 w-5" />
                    )}
                  </Button>
                )}

                <Button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  variant="secondary"
                  className="rounded-full h-11 w-11 cursor-pointer hover:scale-105 transition-transform"
                >
                  {isFullScreen ? (
                    <Minimize className="h-5 w-5" />
                  ) : (
                    <Maximize className="h-5 w-5" />
                  )}
                </Button>

                <Button
                  onClick={handleEndCall}
                  variant="destructive"
                  className="rounded-full h-11 w-11 shadow-md cursor-pointer hover:scale-110 transition-transform"
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {errorMessage && <ErrorAlert message={errorMessage} />}
    </div>
  );
}

function AvatarFallbackUI({
  name,
  image,
  size = "large",
}: {
  name?: string;
  image?: string;
  size?: "small" | "large";
}) {
  const isSmall = size === "small";
  const dimClass = isSmall ? "h-14 w-14" : "h-28 w-28";
  const textClass = isSmall ? "text-xl" : "text-3xl";
  const gradient = getGradient(name || "U");

  return (
    <div className="relative flex items-center justify-center">
      <Avatar className={cn(dimClass, "ring-2 ring-border/30 shadow-xl")}>
        <AvatarImage
          src={image}
          alt={name}
          draggable={false}
          className="object-cover"
        />
        <AvatarFallback
          className={cn(
            textClass,
            "bg-linear-to-br text-white font-bold",
            gradient,
          )}
        >
          {name?.[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  useEffect(() => {
    if (message) {
      toast.error(message);
    }
  }, [message]);
  return null;
}
