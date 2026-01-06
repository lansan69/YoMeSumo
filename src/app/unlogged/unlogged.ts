import { Component } from '@angular/core';
import { Aside } from './aside/aside';
import { Main } from './main/main';
import { Login } from "./login/login";

@Component({
  selector: 'app-unlogged',
  imports: [Aside, Main, Login],
  templateUrl: './unlogged.html',
  styleUrl: './unlogged.css',
})
export class Unlogged {
  private searchTerm:string = "";
  private searchCategory:string = "publicaciones";
  public showLogin = false;

  filterSearch(event: Event){
    const query = (event.target as HTMLInputElement).value.toLowerCase();
    this.searchTerm = query;
  }

  setcategory(event: Event){
    const selectedValue = (event.target as HTMLSelectElement).value;
    this.searchCategory = selectedValue;
    console.log(this.searchCategory);
  }

  getSearch(){
    return this.searchTerm;
  }

  getcategory(){
    return this.searchCategory;
  }

  setModalLoginTrue(){
    this.showLogin = true;
  }

  setModalLoginFalse(){
    this.showLogin = false;
  }

  
}
