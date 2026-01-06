import { Component, OnInit, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DatabaseService } from '../../services/database';
// Ensure Association is imported correctly
import { Association } from '../../models/post.model';

declare var lucide: any;

@Component({
  selector: 'app-aside',
  imports: [CommonModule],
  templateUrl: './aside.html',
  styleUrl: './aside.css',
})
export class Aside implements OnInit {
  @Output() logout = new EventEmitter<void>();
  @Output() screenChange = new EventEmitter<string>();

  // Updated Output to emit Association instead of User
  @Output() currentAssocData = new EventEmitter<Association | undefined>();

  private dbService = inject(DatabaseService);

  activeView: string = 'llamados';

  // Updated variable to store Association info
  currentAssociation: Association | undefined;

  ngOnInit(): void {
    this.loadAssociation(); // Changed from loadUser to loadAssociation
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  loadAssociation() {
    // 1. Retrieve the UID (assuming the logged-in ID belongs to the Association)
    const uid = localStorage.getItem('userid');

    // 2. Check if UID exists
    if (uid) {
      console.log('Found ID:', uid);

      // 3. Call the new service method
      this.dbService.getAssociationById(uid).subscribe({
        next: (assocData) => {
          if (assocData) {
            // 4. Save the info to your variable
            this.currentAssociation = assocData;

            // Emit the data to the parent
            this.currentAssocData.emit(assocData);
            console.log('Association data loaded:', this.currentAssociation);
          } else {
            console.warn('ID exists but no Association data found in Firestore.');
          }
        },
        error: (err) => {
          console.error('Error fetching association:', err);
        }
      });
    } else {
      console.log('No user/association logged in.');
    }
  }

  // Helper to get initials based on Association Name
  getInitials(): string {
    if (!this.currentAssociation || !this.currentAssociation.nameAssociation) return '?';
    // Using nameAssociation instead of displayName
    return this.currentAssociation.nameAssociation.charAt(0).toUpperCase();
  }

  onLogout() {
    this.logout.emit();
  }

  changeActive(viewName: string) {
    this.activeView = viewName;
    this.screenChange.emit(viewName);
  }
}