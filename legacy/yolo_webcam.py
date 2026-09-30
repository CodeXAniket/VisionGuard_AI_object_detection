import cv2
import time
import os
from datetime import datetime
from ultralytics import YOLO

def main():
    # Ensure detections folder exists
    os.makedirs('detections', exist_ok=True)

    # Load YOLOv8 model
    model = YOLO('yolov8n.pt')
    class_names = list(model.names.values())

    # Prompt user at start
    print("Welcome to the Custom YOLO Event Logger!")
    prompt = input("Enter what you want to find (e.g., 'find bottle', 'look for a person'): ")
    prompt_lower = prompt.lower()
    
    # Parse the prompt to find a matching YOLO class
    target_class = None
    for name in sorted(class_names, key=len, reverse=True):
        if name in prompt_lower or f"{name}s" in prompt_lower or f"{name}es" in prompt_lower:
            target_class = name
            break
            
    if not target_class:
        print("Error: Could not recognize any valid objects in your prompt.")
        print("Valid examples: 'person', 'bottle', 'cell phone', 'cup', etc.")
        return

    print(f"\nTarget locked: '{target_class}'")

    # Start webcam
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not access the webcam.")
        return

    print("Starting webcam... Press 'q' to quit.")

    # Event logging variables
    cooldown = 4.0  # seconds between saves
    last_save_time = 0
    show_message_until = 0

    while True:
        success, frame = cap.read()
        if not success:
            break

        # Run inference
        results = model(frame)

        # Plot bounding boxes on the frame
        annotated_frame = results[0].plot()

        # Check for TARGET class
        target_detected = False
        for box in results[0].boxes:
            class_id = int(box.cls[0])
            detected_name = model.names[class_id]
            if detected_name == target_class:
                target_detected = True
                break

        current_time = time.time()

        # Handle event logging
        if target_detected and (current_time - last_save_time > cooldown):
            # Generate timestamp filename
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            filename = f"detections/{target_class}_{timestamp}.jpg"
            
            # Save the frame
            cv2.imwrite(filename, annotated_frame)
            print(f"Event logged: {filename}")
            
            # Update state
            last_save_time = current_time
            show_message_until = current_time + 2.0  # Show message for 2 seconds

        # Add clean UI overlay
        # 1. Overlay the user prompt
        cv2.putText(annotated_frame, f"Prompt: {prompt}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 4)
        cv2.putText(annotated_frame, f"Prompt: {prompt}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

        # 2. Overlay detection status
        if target_detected:
            status_text = f"Status: {target_class.capitalize()} Found!"
            status_color = (0, 255, 0)  # Green
        else:
            status_text = "Status: Searching..."
            status_color = (0, 255, 255)  # Yellow
            
        cv2.putText(annotated_frame, status_text, (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 4)
        cv2.putText(annotated_frame, status_text, (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, status_color, 2)

        # 3. Screenshot saved confirmation
        if current_time < show_message_until:
             cv2.putText(annotated_frame, f"Screenshot Saved ({target_class})", (20, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 4)
             cv2.putText(annotated_frame, f"Screenshot Saved ({target_class})", (20, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        # Show frame
        cv2.imshow("Custom Event Logger", annotated_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # Cleanup
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
