import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // If you use ngModel

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  // Toggle between Login (false) and Register (true)
  isSignUpActive: boolean = false;

  // Event to tell parent to close this modal
  @Output() close = new EventEmitter<void>();

  togglePanel() {
    this.isSignUpActive = !this.isSignUpActive;
  }

  closeModal() {
    this.close.emit();
  }

  get isMobile(): boolean {
    return window.innerWidth < 768; // 768px is 'md' in Tailwind
  }
}