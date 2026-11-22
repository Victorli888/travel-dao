interface Props {
  message: string;
}

/** A sign-in notice: muted rather than alarming, since most are expected. */
export default function AuthNotice({ message }: Props) {
  return (
    <p role="alert" className="rounded-lg border border-line bg-white/5 px-4 py-2.5 text-xs text-zinc-300">
      {message}
    </p>
  );
}
