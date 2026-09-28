import React from 'react';
import { Icon } from '../Icon/Icon';
import styles from './OnboardingModal.module.css';

interface OnboardingModalProps {
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose }) => {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.iconContainer} aria-hidden="true">
            <Icon name="wallet" size={28} />
          </div>
          <h2 id="onboarding-title" className={styles.title}>
            ようこそ家計簿アプリへ
          </h2>
        </div>

        <div className={styles.featureList}>
          <div className={styles.featureItem}>
            <div className={styles.featureIcon} aria-hidden="true">
              <Icon name="lock" size={20} />
            </div>
            <div>
              <div className={styles.featureTitle}>完全ローカル保存</div>
              <p className={styles.featureText}>
                入力されたデータはこの端末・このブラウザ内にのみ保存されます。
              </p>
            </div>
          </div>

          <div className={styles.featureItem}>
            <div className={styles.featureIcon} aria-hidden="true">
              <Icon name="check" size={20} />
            </div>
            <div>
              <div className={styles.featureTitle}>サーバー共有なし</div>
              <p className={styles.featureText}>
                外部のサーバーや他の人にデータが送信・共有されることは一切ありません。
              </p>
            </div>
          </div>

          <div className={styles.featureItem}>
            <div className={styles.featureIcon} aria-hidden="true">
              <Icon name="smartphone" size={20} />
            </div>
            <div>
              <div className={styles.featureTitle}>ホーム画面に追加して使用</div>
              <p className={styles.featureText}>
                iPhoneでは共有ボタンから「ホーム画面に追加」をタップすると、アプリ単体で快適に利用できます。
              </p>
            </div>
          </div>
        </div>

        <button type="button" className={styles.button} onClick={onClose}>
          家計簿をはじめる
        </button>
      </div>
    </div>
  );
};
