import React, { useEffect, useState, useRef } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { auth, db, storage } from "../firebase-config";
import MessageComponent from "../components/MessageComponent";
import Navbar from "../components/Navbar";
import FilePreview from "../components/FilePreview";
import FileInput from "../components/FileInput";
import TextInput from "../components/TextInput";
import { SignUserOutProps } from "../types/SignUserOutProps";
import { Message } from "../types/Message";
import { Room } from "../types/Room";

export interface ChatProps extends SignUserOutProps, Room {
  room: Room;
  resetRoom: Function;
}

const Chat: React.FC<ChatProps> = ({ room, resetRoom, signUserOut }) => {
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedImage, setSelectedImage] = useState<null | Blob>(null);
  const [imageURL, setImageURL] = useState<string>("");
  const [imageName, setImageName] = useState<string>("");
  const [toggleDisable, setToggleDisable] = useState<boolean>(true);
  const messagesRef = collection(db, "messages");
  const chatRef = useRef<null | HTMLDivElement>(null);
  let progress: number = 0;

  const clearStates = () => {
    progress = 0;
    setSelectedImage(null);
    setImageURL("");
    setImageName("");
    setNewMessage("");
    setToggleDisable(true);
  };

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollIntoView();
    }
  }, [messages]);

  useEffect(() => {
    const queryMessages = query(
      messagesRef,
      where("room", "==", room.name),
      orderBy("createdAt")
    );
    const unsubscribe = onSnapshot(queryMessages, (snapshot) => {
      let messagesArray: Message[] = [];
      snapshot.forEach((doc) => {
        messagesArray.push({ ...doc.data(), id: doc.id } as Message);
      });
      setMessages(messagesArray);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const getTime = (unixTimestamp: number) => {
    const date = new Date(unixTimestamp * 1000);
    const day = date.toLocaleDateString("en-IN", {
      month: "2-digit",
      day: "2-digit",
    });
    const time = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `on ${day} @ ${time}`;
  };

  const uploadImage = (selectedImage: Blob) => {
    const storageRef = ref(storage, selectedImage.name);
    const uploadTask = uploadBytesResumable(storageRef, selectedImage);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        progress = Math.trunc(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        console.log(`${progress}% done`);
      },
      (error) => {
        console.log(error);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          setImageURL(downloadURL);
          setImageName(uploadTask.snapshot.ref.name);
          setToggleDisable(false);
          console.log(`Download link available at: ${downloadURL}`);
        });
      }
    );
  };

  const handleSubmit = async (e: React.SyntheticEvent<EventTarget>) => {
    e.preventDefault();
    if (newMessage === "" && selectedImage === null) return;
    if (auth.currentUser) {
      await addDoc(messagesRef, {
        text: newMessage,
        createdAt: serverTimestamp(),
        profilePhoto: auth.currentUser.photoURL,
        imageURL,
        imageNameMessage: imageName,
        user: auth.currentUser.displayName,
        roomName: room.name,
      });
    }
    clearStates();
  };

  useEffect(() => {
    if (selectedImage != null) {
      uploadImage(selectedImage);
    }
  }, [selectedImage]);

  return (
    <div>
      <Navbar room={room} resetRoom={resetRoom} signUserOut={signUserOut} />
      <div className="overflow-y-auto mt-[7em] mb-[6em]">
        {messages.map((message) => (
          <MessageComponent
            key={crypto.randomUUID()}
            message={message}
            getTime={getTime}
          />
        ))}
        <div ref={chatRef} />
      </div>
      <form className="w-full bottom-0 fixed" onSubmit={handleSubmit}>
        <FilePreview
          selectedImage={selectedImage}
          imageName={imageName}
          imageURL={imageURL}
          setSelectedImage={setSelectedImage}
          setImageName={setImageName}
          setImageURL={setImageURL}
        />
        <div className="font-robotomono py-6 bg-[#5C5470] p-4 pl-6 mt-6 flex justify-center">
          <FileInput setSelectedImage={setSelectedImage} />
          <TextInput
            room={room}
            setNewMessage={setNewMessage}
            newMessage={newMessage}
            selectedImage={selectedImage}
            toggleDisable={toggleDisable}
          />
        </div>
      </form>
    </div>
  );
};

export default Chat;
