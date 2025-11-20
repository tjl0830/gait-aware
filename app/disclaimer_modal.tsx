import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';

const DisclaimerModal = () => {
    const [isOpen, setIsOpen] = useState(true);

    const closeModal = () => {
        setIsOpen(false);
    };

    useEffect(() => {
        // Logic to show modal on app startup
        setIsOpen(true);
    }, []);

    return (
        <Modal isOpen={isOpen} onRequestClose={closeModal} contentLabel="Disclaimer Modal">
            <div style={{ textAlign: 'center' }}>
                <h2>IMPORTANT: Not a Medical Diagnostic Tool</h2>
                <p>
                    GaitAware provides informational and educational analysis of walking patterns (gait) using video. It is NOT a medical device and should NOT be used for self-diagnosis or as a substitute for professional medical advice.

                    • <span style={{ fontWeight: 'bold' }}>For medical concerns, always consult a qualified physician or healthcare professional. </span>

                    • The results from this app are for general wellness and background purposes only.
                    
                    By using GaitAware, you acknowledge and accept these terms.
                </p>
                <button onClick={closeModal}>Okay</button>
            </div>
        </Modal>
    );
};

export default DisclaimerModal;