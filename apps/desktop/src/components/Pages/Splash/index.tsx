import styles from './index.module.scss';
import Logo from '../../Logo/Linen';
import Button from '../../Button/Gradient';
import { FiRss } from 'react-icons/fi';

interface Props {
  onClick(): void;
}

export default function SplashPage({ onClick }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.column}>
        <Logo />
        <header className={styles.header}>
          <h1>Streamline communication with your customers</h1>
          <p>
            It is easy to miss conversations in traditional chat apps. In Linen
            you can manage all of your conversations from multiple channels in a
            single Feed view. With open/close states you can view all the
            conversations that need your attention in a single page.
          </p>
        </header>

        <Button onClick={onClick}>Sign In</Button>
      </div>
      <div className={styles.column}>
        <FiRss className={styles.icon} />
      </div>
    </div>
  );
}