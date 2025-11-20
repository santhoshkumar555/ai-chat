import { useEffect, useRef, useState } from "react";
import "./newPrompt.css";
import Upload from "../upload/Upload";
import { IKImage } from "imagekitio-react";
import model from "../../lib/gemini";
import Markdown from "react-markdown";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const NewPrompt = ({ data }) => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [img, setImg] = useState({
    isLoading: false,
    error: "",
    dbData: {},
    aiData: {},
  });

  const chat = model.startChat({
    history: data?.history?.map(({ role, parts }) => ({
      role,
      parts: [{ text: parts[0].text }],
    })),
    generationConfig: {},
  });

  const endRef = useRef(null);
  const formRef = useRef(null);
  const queryClient = useQueryClient();

  // Always scroll to bottom when answer or image updates
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data, question, answer, img.dbData]);

  // --- Backend update mutation ---
  const mutation = useMutation({
    mutationFn: (payload) =>
      fetch(`${import.meta.env.VITE_API_URL}/api/chats/${data._id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", data._id] });
      formRef.current?.reset();
      setQuestion("");
      setAnswer("");
      setImg({ isLoading: false, error: "", dbData: {}, aiData: {} });
    },
    onError: (err) => console.log("Mutation Error:", err),
  });

  // --- Send message and stream AI reply ---
  const add = async (text, isInitial) => {
    if (!isInitial) setQuestion(text);

    try {
      const result = await chat.sendMessageStream(
        Object.entries(img.aiData).length ? [img.aiData, text] : [text]
      );

      let accumulatedText = "";

      // Stream AI response in real time
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        accumulatedText += chunkText;
        setAnswer(accumulatedText);

        // 🔥 Update React Query cache immediately so ChatPage shows it live
        queryClient.setQueryData(["chat", data._id], (old) => {
          if (!old) return old;
          const newHistory = [...old.history];

          // Prevent duplicate temporary answer entries
          if (newHistory[newHistory.length - 1]?.role === "model") {
            newHistory[newHistory.length - 1].parts[0].text = accumulatedText;
          } else {
            newHistory.push({ role: "model", parts: [{ text: accumulatedText }] });
          }

          return {
            ...old,
            history: newHistory,
          };
        });
      }

      // Save to backend
      mutation.mutate({
        question: isInitial ? undefined : text,
        answer: accumulatedText,
        img: img.dbData?.filePath || undefined,
      });
    } catch (err) {
      console.log("Chat Error:", err);
    }
  };

  // --- Form submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = e.target.text.value.trim();
    if (!text) return;

    // Immediately show user's message in ChatPage
    queryClient.setQueryData(["chat", data._id], (old) => {
      if (!old) return old;
      return {
        ...old,
        history: [...old.history, { role: "user", parts: [{ text }] }],
      };
    });

    add(text, false);
  };

  // --- Auto-run initial message if required ---
  const hasRun = useRef(false);
  useEffect(() => {
    if (!hasRun.current) {
      if (data?.history?.length === 1) {
        add(data.history[0].parts[0].text, true);
      }
      hasRun.current = true;
    }
  }, [data]);

  return (
    <>
      {/* Image Preview */}
      {img.isLoading && <div>Loading...</div>}
      {img.dbData?.filePath && (
        <IKImage
          urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT}
          path={img.dbData.filePath}
          width="380"
          transformation={[{ width: 380 }]}
        />
      )}

      {/* Temporary Local Message Display */}
      {question && <div className="message user">{question}</div>}
      {answer && (
        <div className="message">
          <Markdown>{answer}</Markdown>
        </div>
      )}

      <div className="endChat" ref={endRef}></div>

      {/* Input Form */}
      <form className="newForm" onSubmit={handleSubmit} ref={formRef}>
        <Upload setImg={setImg} />
        <input className="fileimg" id="file" type="file" multiple={false} hidden />
        <input type="text" name="text" placeholder="Ask anything..." />
        <button type="submit">
          <img src="/arrow.png" alt="send" />
        </button>
      </form>
    </>
  );
};

export default NewPrompt;
