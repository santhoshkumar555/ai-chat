import { Outlet, useNavigate } from "react-router-dom";
import "./dashboardLayout.css";
import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import ChatList from "../../components/chatList/ChatList";

const DashboardLayout = () => {
  const { userId, isLoaded } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isLoaded && !userId) {
      navigate("/sign-in");
    }
  }, [isLoaded, userId, navigate]);

  if (!isLoaded) return "Loading...";

  return (
    <div className="dashboardLayout">
      <div className="menuToggle" onClick={() => setIsOpen((prev) => !prev)}>
        <img src="/menu.png" alt="" />
      </div>
      <div className={`menu ${isOpen ? "active" : ""}`}>
        <ChatList closeMenu={() => setIsOpen(false)} />
      </div>
      <div className="content">
        <Outlet />
      </div>
    </div>
  );
};

export default DashboardLayout;
