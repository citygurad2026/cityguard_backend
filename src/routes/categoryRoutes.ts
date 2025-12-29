import { Router } from "express";
import { createCategory,getCategory,getCategories,updateCategory,deleteCategory } from "../controllers/Categores/categoryController";
const categoryrouter=Router()

categoryrouter.post('/createcategory', createCategory);
categoryrouter.get('/getcategories', getCategories);
categoryrouter.get('/getcategory/:id', getCategory);
categoryrouter.put('/updatecategory/:id', updateCategory);
categoryrouter.delete('/deletecategory/:id', deleteCategory);

export default categoryrouter;