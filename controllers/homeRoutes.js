const router = require("express").Router();
const sequelize = require('../config/connection');
const withAuth = require("../utils/auth");
const multer = require("multer");
const { promises: fs } = require("fs");
const im = require("imagemagick");
var path = require("path");
const pdfConverter = require("pdf-poppler");
const { Categories, Types, Files, Users, Reviews, Downloads } = require("../models");
const { sync } = require("../models/Users");
const path_temp = "public/uploads/temp/";
const path_pdf = "public/uploads/doc/";
const path_img = "public/uploads/img/";
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path_pdf);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); //Appending extension
  },
});

var upload = multer({ storage: storage });

const convertImage=async (pdfPath,imgpath,page)=> {
  let option = {
    format: "jpeg",
    out_dir: imgpath,
    out_prefix: path.basename(pdfPath, path.extname(pdfPath)),
    page: page,
  };
  // option.out_dir value is the path where the image will be saved

  await pdfConverter
    .convert(pdfPath, option)
    .then(() => {
      console.log("file converted");
    })
    .catch((err) => {
      console.log("an error has occurred in the pdf converter " + err);
    });
  return path.basename(pdfPath, path.extname(pdfPath));
}
var resultHandler = function(err) { 
  if(err) {
     console.log("unlink failed", err);
  } else {
     console.log("file deleted");
  }
}
const loadTempPdfImages=async (source_file) =>{
  var img_list=[];
  try {
    const files = await fs.readdir(path_temp);
    if(files)
    {
      const unlinkPromises =await files.map(filename => fs.unlink(`${path_temp}/${filename}`,resultHandler));
      await Promise.all(unlinkPromises);
    }
    await convertImage(path.join(path_pdf,source_file),path_temp,null)
    await fs.readdir(path_temp).then((files_new)=>{
      let count=0;
      //listing all files using forEach
      files_new.forEach(function (file) {
      count=count+1;
        if(count<5)
        {
          img_list.push(file);
        }
       
    });

    });
  
   
   
  

  } catch(err) {
    console.log(err);
  }
 return img_list;
}
const getDocumentCategory = async () => {
  const data1 = await Categories.findAll();
  const category = data1.map((data) => data.get({ plain: true }));
  return category;
};

const getDocumentType = async () => {
  const data2 = await Types.findAll();
  const doc_type = data2.map((data) => data.get({ plain: true }));

  return doc_type;
};

router.get("/", async (req, res) => {
  try {
   
    const docs = await Files.findAll({
      limit: 8,
      order: [
        [sequelize.literal('RAND()')]
      ],
    });

    const docs1 = await Files.findAll({
      limit: 4,
      order: [["id", "DESC"]],
      include: [
        {
          model: Users,
          attributes: ["first_name", "last_name"],
        },
        {
          model: Categories,
          attributes: ["category_name"],
        },
        {
          model: Types,
          attributes: ["type_name"],
        },
      ],
    });
    const docs2 = await Downloads.findAll({
      limit: 4,
      group: ["file_id"],
    order: [[sequelize.col("CountedValue"), "DESC"]],
      attributes:[ [sequelize.fn("COUNT", "1"), "CountedValue"],"file_id"],
      include:[{model:Files,
      attributes:["id","title","brief_description","price","source_file","cover_art","user_id"],
      include: [
        {
          model: Users,
          attributes: ["first_name", "last_name"],
        },
        {
          model: Categories,
          attributes: ["category_name"],
        },
        {
          model: Types,
          attributes: ["type_name"],
        },
       
      ],
    }]
      
    });

    // Serialize data so the template can read it
    const randomDoc = docs.map((doc) => doc.get({ plain: true }));
    const latestdoc = docs1.map((doc) => doc.get({ plain: true }));
    const popularDoc = docs2.map((doc) => doc.get({ plain: true }));

    res.render("homepage", {
      randomDoc,
      popularDoc,
      latestdoc,
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("/upload", async (req, res) => {
  try {
    const doc_type = await getDocumentType();
    const category = await getDocumentCategory();
    res.render("addFiles", { category, doc_type });
  } catch (err) {
    res.status(500).json(err);
  }
});
router.get("/addreview/:id", async (req, res) => {
  try {
   res.render("addReview",{id:req.params.id});
  } catch (err) {
    res.status(500).json(err);
  }
});
router.post("/upload", upload.single("source_file"), async (req, res, next) => {
  try {
    var img_name = await convertImage(
      path.join(req.file.destination, req.file.filename),path_img,1
    );
    img_name = img_name + "-1.jpg";

    const fileData = await Files.create({
      title: req.body.title,
      brief_description: req.body.brief_description,
      user_id: req.session.user_id,
      price: req.body.price,
      cover_art: img_name,
      type_id: req.body.type_id,
      category_id: req.body.category_id,
      source_file: req.file.filename,
      user_id: 1,
    });
    // console.log(req.file, req.body,req.file.filename,img_name)
    console.log(fileData);
    res.redirect("/");
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("/login", async (req, res) => {
  try {
    res.render("userLogin");
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("/profile/:id", async (req, res) => {
  try {
    const userData = await Users.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{all: true, nested: true}],
    });
    
    const user = userData.get({plain: true});
    
    res.render("profile", {user});
    // res.json(user)
  } catch (err) {
    res.status(500).json(err);
  }
})

router.get("/register", async (req, res) => {
  try {
    res.render("signUp");
  } catch (err) {
    res.status(500).json(err);
  }
});
router.get("/file/:id", async (req, res) => {
  try {

    const data = await Files.findByPk(req.params.id, {
      include: [
        {
          model: Users,
          attributes: ["first_name","last_name"],
        },
        {
          model: Categories,
          attributes: ["category_name"],
        },
        {
          model: Types,
          attributes: ["type_name"],
        },
        {
          model: Reviews,
          attributes: ["review_content","rating"],
          include:[{model:Users,attributes: ["first_name","last_name"]}]
        },
        {
          model: Downloads,
          attributes: ["price","id"],
          include:[{model:Users,attributes: ["first_name","last_name"]}]
        },
      ],
    });
    const fileobj = data.get({ plain: true });
    const preview_img=await loadTempPdfImages(fileobj.source_file);
     res.render("file",{fileobj,preview_img});
  } catch (err) {
    res.status(500).json(err);
  }
});
module.exports = router;
