import { Component, OnInit, Output, EventEmitter, inject, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit, NgZone, ViewEncapsulation } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { Aside } from './aside/aside';
import { Main } from './main/main';
import { DatabaseService } from '../services/database';
import { Association, Post, PostApplicant } from '../models/post.model';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { take } from 'rxjs/operators';

declare var lucide: any;
declare var google: any;
declare var iziToast: any; // Declaramos iziToast

@Component({
  selector: 'app-asociacion',
  imports: [Aside, Main, CommonModule, FormsModule],
  templateUrl: './asociacion.html',
  styleUrl: './asociacion.css',
  encapsulation: ViewEncapsulation.None
})
export class Asociacion implements OnInit {
  private dbService = inject(DatabaseService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  @ViewChild('addressInput') addressInput!: ElementRef;

  ngOnInit(): void {
    this.refreshIcons();
    
    // Configuración Global de iziToast (Mismo estilo que Ayudante)
    if (typeof iziToast !== 'undefined') {
      iziToast.settings({
        timeout: 4000,
        resetOnHover: true,
        transitionIn: 'flipInX',
        transitionOut: 'flipOutX',
        position: 'topRight',
        theme: 'light',
        progressBarColor: '#ADC2A9',
        imageWidth: 50,
        layout: 2,
        balloon: false,
        close: true,
        closeOnEscape: true,
      });
    }
  }
  
  ngAfterViewInit(): void {
    this.initAutocomplete();
  }

  newPostForm = {
    title: '',
    description: '',
    supplies: '',
    location: ''
  };

  selectedCoordinates: { lat: number, lng: number } | null = null;

  // State Variables
  searchTerm: string = "";
  searchCategory: string = "publicaciones";
  showLogin = false;
  currentScreen = "llamados";
  currentAssociation: Association | undefined = undefined;

  // Data
  myPosts: Post[] = [];
  postApplicants: { [key: string]: PostApplicant[] } = {};

  @Output() category = new EventEmitter<string>();
  @Output() logout = new EventEmitter<void>();

  filterSearch(event: Event) { this.searchTerm = (event.target as HTMLInputElement).value.toLowerCase(); }
  setcategory(event: Event) { this.searchCategory = (event.target as HTMLSelectElement).value; }
  getSearch() { return this.searchTerm; }
  getcategory() { return this.searchCategory; }

  // --- BLOQUE DE EDICIÓN DE PERFIL ---
  isEditingAssociation: boolean = false;

  toggleEdit() {
    this.isEditingAssociation = !this.isEditingAssociation;
  }

  saveAssociationData() {
    if (!this.currentAssociation || !this.currentAssociation.id) return;

    console.log("Iniciando validación de datos...");
    const emailToCheck = this.currentAssociation.email.trim();

    // 1. VALIDACIÓN DE CORREO
    forkJoin({
      userCheck: this.dbService.getUserByEmail(emailToCheck).pipe(take(1)),
      assocCheck: this.dbService.getAssociationByEmail(emailToCheck).pipe(take(1))
    }).subscribe(async (results) => {
      
      const userExists = results.userCheck;
      const assocExists = results.assocCheck;

      if (userExists || (assocExists && assocExists.id !== this.currentAssociation!.id)) {
        
        // REEMPLAZO ALERT -> IZITOAST ERROR
        iziToast.error({
          title: 'Error de Correo',
          message: 'El correo electrónico ya está registrado en otra cuenta.',
          position: 'center'
        });
        return; 

      } else {
        const datosActualizados = {
          encargado: this.currentAssociation!.encargado,
          phone: this.currentAssociation!.phone,
          description: this.currentAssociation!.description,
          email: emailToCheck 
        };

        console.log("Correo válido. Guardando cambios...", datosActualizados);

        try {
          await this.dbService.updateAssociation(this.currentAssociation!.id, datosActualizados);
          
          // REEMPLAZO CONSOLE.LOG -> IZITOAST SUCCESS
          iziToast.success({
            title: '¡Actualizado!',
            message: 'La información de la asociación se guardó correctamente.',
          });
          
          this.isEditingAssociation = false;
        } catch (error) {
          console.error('Error al actualizar asociación:', error);
          iziToast.error({ title: 'Error', message: 'No se pudieron guardar los cambios.' });
        }
      }
    });
  }
  // -----------------------------------

  changeScreen(event: string) {
    this.currentScreen = event;
    this.refreshIcons();
  }

  getAssociationData(event: Association | undefined) {
    this.currentAssociation = event;
    if (this.currentAssociation && this.currentAssociation.id) {
      this.loadAssociationPosts(this.currentAssociation.id);
    } else {
      this.myPosts = [];
      this.postApplicants = {};
    }
  }

  getPendingCount(postId: string): number {
    const applicants = this.postApplicants[postId] || [];
    return applicants.filter(a => a.status !== 'accepted').length;
  }

  loadAssociationPosts(authorId: string) {
    this.dbService.getPostsByAuthor(authorId).subscribe({
      next: (posts) => {
        this.myPosts = posts;
        this.cdr.detectChanges();
        this.myPosts.forEach(post => {
          if (post.id) this.loadApplicantsForPost(post.id);
        });
        this.refreshIcons();
      },
      error: (err) => console.error('Error loading posts:', err)
    });
  }

  loadApplicantsForPost(postId: string) {
    this.dbService.getApplicantsByPostId(postId).subscribe({
      next: (applicants) => {
        this.postApplicants = {
          ...this.postApplicants,
          [postId]: applicants
        };
        this.cdr.detectChanges();
        this.refreshIcons();
      }
    });
  }

  async updateApplicantStatus(applicant: PostApplicant, newStatus: 'accepted' | 'rejected') {
    if (!applicant.applicantId) return;
    try {
      await this.dbService.updateApplicantStatus(applicant.applicantId, newStatus);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  refreshIcons() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        if (typeof lucide !== 'undefined') {
          lucide.createIcons();
        }
      }, 50);
    });
  }

  getWhatsappLink(phone: string, postTitle: string): string {
    const text = `Hola, vi tu solicitud para sumarte a "${postTitle}".`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  openPostIds = new Set<string>();

  togglePost(postId: string | undefined) {
    if (!postId) return;
    if (this.openPostIds.has(postId)) {
      this.openPostIds.delete(postId);
    } else {
      this.openPostIds.add(postId);
    }
    this.refreshIcons();
  }

  isPostOpen(postId: string | undefined): boolean {
    return postId ? this.openPostIds.has(postId) : false;
  }

  logOut() {
    localStorage.removeItem('userid');
    this.logout.emit();
  }

  async completeCitation(applicant: PostApplicant) {
    if (!applicant.applicantId) return;
    
    // REEMPLAZO CONFIRM -> QUESTION
    iziToast.question({
      timeout: 20000,
      close: false,
      overlay: true,
      displayMode: 'once',
      id: 'question',
      zindex: 999,
      title: 'Finalizar',
      message: '¿Marcar esta cita como completada?',
      position: 'center',
      buttons: [
        ['<button><b>SÍ</b></button>', async (instance: any, toast: any) => {
          instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
          
          try {
            await this.dbService.updateApplicantStatus(applicant.applicantId!, 'completed');
            iziToast.success({ title: 'Completado', message: 'Cita marcada como exitosa.' });
          } catch (error) {
            console.error('Error completing citation:', error);
            iziToast.error({ title: 'Error', message: 'No se pudo actualizar el estado.' });
          }

        }, true],
        ['<button>NO</button>', (instance: any, toast: any) => {
          instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
        }]
      ]
    });
  }

  async createNewPost() {
    if (!this.currentAssociation || !this.currentAssociation.id) {
      console.error('No association logged in');
      return;
    }
    if (!this.newPostForm.title || !this.newPostForm.description) {
      iziToast.warning({
        title: 'Faltan datos',
        message: 'Por favor completa el título y la descripción.',
        position: 'center'
      });
      return;
    }

    const postData: Partial<Post> = {
      authorId: this.currentAssociation.id,
      authorName: this.currentAssociation.nameAssociation,
      type: 'request',
      title: this.newPostForm.title,
      description: this.newPostForm.description,
      suppliesList: this.newPostForm.supplies.split(',').map(s => s.trim()).filter(s => s !== ''),
      location: {
        address: this.newPostForm.location,
        lat: this.currentAssociation.location.lat,
        lng: this.currentAssociation.location.lng
      },
      schedule: 'Por coordinar',
      status: 'open',
      applicantsCount: 0
    };

    try {
      await this.dbService.createPost(postData);
      
      iziToast.success({
        title: 'Publicado',
        message: 'Tu Eco ha sido lanzado exitosamente.',
      });

      this.newPostForm = { title: '', description: '', supplies: '', location: '' };
      this.closeEcoModal();
      this.refreshIcons();
    } catch (error) {
      console.error('Error creating post:', error);
      iziToast.error({ title: 'Error', message: 'No se pudo crear la publicación.' });
    }
  }

  async acceptApplicant(applicantId: string) {
    try {
      await this.dbService.updateApplicantStatus(applicantId, 'accepted');
      this.updateLocalApplicantStatus(applicantId, 'accepted');
      
      iziToast.success({
        title: '¡Aceptado!',
        message: 'Has aceptado al sumador. ¡Ponte en contacto!',
        timeout: 5000
      });

    } catch (error) {
      console.error('Error accepting applicant:', error);
      iziToast.error({ title: 'Error', message: 'Hubo un problema al aceptar.' });
    }
  }

  async rejectApplicant(applicantId: string) {
    
    // REEMPLAZO CONFIRM -> QUESTION
    iziToast.question({
      timeout: 20000,
      close: false,
      overlay: true,
      displayMode: 'once',
      id: 'question',
      zindex: 999,
      title: 'Rechazar',
      message: '¿Seguro que deseas rechazar a este sumador?',
      position: 'center',
      buttons: [
        ['<button><b>SÍ, RECHAZAR</b></button>', async (instance: any, toast: any) => {
          instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
          
          try {
            await this.dbService.updateApplicantStatus(applicantId, 'rejected');
            this.updateLocalApplicantStatus(applicantId, 'rejected');
            iziToast.info({ title: 'Rechazado', message: 'Solicitud rechazada.' });
          } catch (error) {
            console.error('Error rejecting applicant:', error);
            iziToast.error({ title: 'Error', message: 'No se pudo procesar el rechazo.' });
          }

        }, true],
        ['<button>CANCELAR</button>', (instance: any, toast: any) => {
          instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
        }]
      ]
    });
  }

  private updateLocalApplicantStatus(applicantId: string, newStatus: 'pending' | 'accepted' | 'rejected' | 'completed') {
    for (const postId in this.postApplicants) {
      if (this.postApplicants.hasOwnProperty(postId)) {
        const applicantIndex = this.postApplicants[postId].findIndex(app => app.applicantId === applicantId);
        if (applicantIndex !== -1) {
          this.postApplicants[postId][applicantIndex].status = newStatus;
          break;
        }
      }
    }
  }

  initAutocomplete() {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn("Google Maps API not loaded yet. Retrying in 500ms...");
      setTimeout(() => this.initAutocomplete(), 500);
      return;
    }
    if (!this.addressInput || !this.addressInput.nativeElement) {
      console.warn("Address Input not found in DOM.");
      return;
    }
    const autocomplete = new google.maps.places.Autocomplete(this.addressInput.nativeElement, {
      componentRestrictions: { country: 'mx' },
      fields: ['geometry', 'formatted_address'],
      types: ['address'],
    });
    autocomplete.addListener('place_changed', () => {
      this.ngZone.run(() => {
        const place = autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) {
          iziToast.warning({ title: 'Ubicación', message: 'No se encontraron detalles para esa dirección.' });
          return;
        }
        this.newPostForm.location = place.formatted_address;
        this.selectedCoordinates = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        console.log("Location Selected:", this.selectedCoordinates);
      });
    });
  }

  showCreateModal = false;
  openEcoModal() {
    this.showCreateModal = true;
    setTimeout(() => {
      this.initAutocomplete();
    }, 100);
  }

  async deletePost(postId: string) {
    
    // REEMPLAZO CONFIRM -> QUESTION
    iziToast.question({
      timeout: 20000,
      close: false,
      overlay: true,
      displayMode: 'once',
      id: 'question',
      zindex: 999,
      title: 'Eliminar',
      message: '¿Eliminar esta publicación? Esta acción no se puede deshacer.',
      position: 'center',
      color: 'red', // Color de advertencia
      buttons: [
        ['<button><b>ELIMINAR</b></button>', async (instance: any, toast: any) => {
          instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
          
          try {
            await this.dbService.deletePost(postId);
            this.myPosts = this.myPosts.filter(post => post.id !== postId);
            delete this.postApplicants[postId];
            this.openPostIds.delete(postId);
            
            iziToast.success({ title: 'Eliminado', message: 'Publicación eliminada correctamente.' });
          } catch (error) {
            console.error('Error eliminating post:', error);
            iziToast.error({ title: 'Error', message: 'No se pudo eliminar la publicación.' });
          }

        }, true],
        ['<button>CANCELAR</button>', (instance: any, toast: any) => {
          instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
        }]
      ]
    });
  }

  closeEcoModal() { this.showCreateModal = false; }
}