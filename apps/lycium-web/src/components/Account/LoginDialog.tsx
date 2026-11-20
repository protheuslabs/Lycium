import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Modal from "../Modal/Modal";
import { MY_LEARNING_PATH } from "../../utils/courseRouting";

type LoginDialogProps = { isOpen: boolean; onClose: () => void };

export default function LoginDialog({ isOpen, onClose }: LoginDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      title="Log in"
      labelledById="login-title"
      describedById="login-availability"
      size="sm"
      onClose={onClose}
    >
      <p id="login-availability" className="login-availability">
        Account sign-in is not available yet.
      </p>
      <Link href={MY_LEARNING_PATH} className="learner-primary-link" onClick={onClose}>
        Continue without an account
        <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </Modal>
  );
}
