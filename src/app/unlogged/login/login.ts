import { Component, EventEmitter, Output, ViewChild, ElementRef, AfterViewInit, inject, ChangeDetectorRef } from '@angular/core'; // <--- 1. Import ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, user } from '@angular/fire/auth';
import { Firestore, doc, setDoc, serverTimestamp, writeBatch } from '@angular/fire/firestore';
import { DatabaseService } from '../../services/database';
import { User, Association } from '../../models/post.model';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

declare var google: any;

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements AfterViewInit {
  // Dependencies
  private auth = inject(Auth);
  private cdr = inject(ChangeDetectorRef); // <--- 2. Inject ChangeDetectorRef
  private firestore = inject(Firestore);
  private dbService = inject(DatabaseService);

  isSignUpActive: boolean = false;
  registerType: 'usuario' | 'asociacion' = 'usuario';

  // Login Specific Variables
  loginEmail: string = '';
  loginPass: string = '';
  loginError: boolean = false;
  @Output() categoryLogged = new EventEmitter<string>();

  // --- REGISTER VARIABLES (Usuario) ---
  regName: string = '';
  regPhone: string = '';
  regEmail: string = '';
  regPass: string = '';

  // --- REGISTER VARIABLES (Asociación) ---
  assocName: string = '';
  assocEncargado: string = '';
  assocCategory: string = '';
  assocDescription: string = '';
  assocPhone: string = '';
  assocEmail: string = '';
  assocPass: string = '';

  regError: string = '';

  // Object to store the clean address and coordinates
  selectedLocation = { address: '', lat: 0, lng: 0 };

  @Output() close = new EventEmitter<void>();
 
  private _addressInput!: ElementRef;

  // The Setter: Captures the element when *ngIf renders it
  @ViewChild('addressInput') set addressInput(content: ElementRef) {
    if (content) {
      console.log("Input element detected in DOM");
      this._addressInput = content;
      this.initAutocomplete();
    }
  }

  initAutocomplete() {
    // 1. Safety Check: If input is gone, stop.
    if (!this._addressInput) return;

    // 2. Critical Check: Is Google Script loaded?
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn("Google Maps API not loaded yet. Retrying...");
      // Retry once after 500ms
      setTimeout(() => this.initAutocomplete(), 500);
      return;
    }

    console.log("Initializing Google Autocomplete...");

    // 3. Initialize
    const autocomplete = new google.maps.places.Autocomplete(this._addressInput.nativeElement, {
      componentRestrictions: { country: 'mx' },
      fields: ['address_components', 'geometry', 'formatted_address'],
      types: ['address'],
    });

    // 4. Add Listener
    autocomplete.addListener('place_changed', () => {
      // Run inside NgZone to update UI immediately
      const place = autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location) {
        window.alert("No details available for input: '" + place.name + "'");
        return;
      }

      this.selectedLocation = {
        address: place.formatted_address,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      };

      console.log("Location Selected:", this.selectedLocation);

      // Force Angular to update the view (to show the green checkmark)
      this.cdr.detectChanges();
    });
  }

  // --- REGISTER LOGIC ---
  onRegister() {
    this.regError = '';

    // Basic Validation for Regular Users
    if (this.registerType === 'usuario') {
      if (!this.regName || !this.regPhone || !this.regEmail || !this.regPass) {
        this.regError = 'Todos los campos son obligatorios';
        return;
      }

      // 1. Create Authentication User
      createUserWithEmailAndPassword(this.auth, this.regEmail, this.regPass)
        .then(async (userCredential) => {
          const uid = userCredential.user.uid;

          // 2. Prepare Data for Firestore
          const newUser: User = {
            uid: uid,
            email: this.regEmail,
            displayName: this.regName,
            phone: this.regPhone,
            favorites: [],
            createdAt: serverTimestamp()
          };

          // 3. Save to Firestore
          try {
            const userRef = doc(this.firestore, `users/${uid}`);
            await setDoc(userRef, newUser, { merge: true });

            console.log('User created in Auth and Firestore');

            // 4. Auto Login / Success
            localStorage.setItem('userid', uid);
            this.closeModal();

          } catch (e) {
            console.error("Error saving to Firestore", e);
            this.regError = 'Error guardando datos de usuario';
          }
        })
        .catch((error) => {
          console.error("Auth Error", error);
          if (error.code === 'auth/email-already-in-use') {
            this.regError = 'El correo ya está registrado';
          } else if (error.code === 'auth/weak-password') {
            this.regError = 'La contraseña debe tener al menos 6 caracteres';
          } else {
            this.regError = 'Error al registrarse. Intente nuevamente.';
          }
          this.cdr.detectChanges();
        });
    }

    // ==========================================
    // 2. ASSOCIATION REGISTRATION
    // ==========================================
    else if (this.registerType === 'asociacion') {
      // Validation
      if (!this.assocName || !this.assocEncargado || !this.assocCategory ||
        !this.assocPhone || !this.assocEmail || !this.assocPass) {
        this.regError = 'Por favor complete todos los campos requeridos';
        return;
      }

      if (this.selectedLocation.lat === 0) {
        this.regError = 'Debe seleccionar una dirección válida del autocompletado';
        return;
      }

      // Create Auth
      createUserWithEmailAndPassword(this.auth, this.assocEmail, this.assocPass)
        .then(async (userCredential) => {
          const uid = userCredential.user.uid;

          // A. Create the base User entry (so they can log in generic systems)
          const newUser: User = {
            uid: uid,
            email: this.assocEmail,
            displayName: this.assocName, // We use Association Name as display name
            phone: this.assocPhone,
            favorites: [],
            createdAt: serverTimestamp()
          };

          // B. Create the Association specific entry
          const newAssociation: Association = {
            id: uid, // We link them using the SAME ID
            encargado: this.assocEncargado,
            nameAssociation: this.assocName,
            description: this.assocDescription,
            categoria: this.assocCategory,
            email: this.assocEmail,
            phone: this.assocPhone,
            location: this.selectedLocation,
            verificationStatus: 'pending'
          };

          try {
            // Save both documents in parallel
            const userRef = doc(this.firestore, `users/${uid}`);
            const assocRef = doc(this.firestore, `asociaciones/${uid}`);

            await Promise.all([
              setDoc(userRef, newUser, { merge: true }),
              setDoc(assocRef, newAssociation, { merge: true })
            ]);

            console.log('Association created successfully');
            localStorage.setItem('userid', uid);
            this.closeModal();

          } catch (e) {
            console.error("Firestore Error", e);
            this.regError = 'Error guardando datos de la asociación';
            this.cdr.detectChanges();
          }
        })
        .catch((error) => this.handleAuthError(error));
    }
  }

  // Helper to save simple user
  async saveUserToFirestore(uid: string, data: any) {
    try {
      const userRef = doc(this.firestore, `users/${uid}`);
      await setDoc(userRef, data, { merge: true });
      localStorage.setItem('userid', uid);
      this.closeModal();
    } catch (e) {
      console.error(e);
      this.regError = 'Error guardando en base de datos';
    }
  }

  // Helper to handle errors
  handleAuthError(error: any) {
    console.error("Auth Error", error);
    if (error.code === 'auth/email-already-in-use') {
      this.regError = 'El correo ya está registrado';
    } else if (error.code === 'auth/weak-password') {
      this.regError = 'La contraseña debe tener al menos 6 caracteres';
    } else {
      this.regError = 'Error al registrarse. Intente nuevamente.';
    }
    this.cdr.detectChanges();
  }

  // --- LOGIN LOGIC ---
  onLogin() {
    this.loginError = false; // Reset error

    if (!this.loginEmail || !this.loginPass) {
      return;
    }

    signInWithEmailAndPassword(this.auth, this.loginEmail, this.loginPass)
      .then((userCredential) => {
        const uid = userCredential.user.uid;
        const category = this.getCategory(uid);
        console.log('Login Successful, UID:', uid);

        localStorage.setItem('userid', uid);
        this.getCategory(uid).subscribe(category => {
          this.emitcategory(category);
          console.log("new category!!", category);
        });
        // this.closeModal();
      })
      .catch((error) => {
        console.error('Login Error', error);

        // 3. Set error and FORCE UI UPDATE
        this.loginError = true;
        this.cdr.detectChanges();
      });
  }

  getCategory(uid: string): Observable<'asociacion' | 'usuario'> {
    // We pipe the result of the service call
    return this.dbService.getAssociationById(uid).pipe(
      map(association => {
        // Logic: If 'association' has data, it is an Association.
        // If it is undefined or null, we assume it is a regular User.
        if (association) {
          return 'asociacion';
        } else {
          return 'usuario';
        }
      })
    );
  }

  togglePanel() {
    this.isSignUpActive = !this.isSignUpActive;
    this.loginError = false; // clear error when switching panels
  }

  closeModal() {
    this.close.emit();
  }

  emitcategory(categoria:string){
    this.categoryLogged.emit(categoria);
    console.log("emitted");
  }

  setRegisterType(type: 'usuario' | 'asociacion') {
    this.registerType = type;
    if (type === 'asociacion') {
      setTimeout(() => {
        this.initAutocomplete();
      }, 100);
    }
  }

  ngAfterViewInit() {
    if (this.registerType === 'asociacion') {
      this.initAutocomplete();
    }
  }
}