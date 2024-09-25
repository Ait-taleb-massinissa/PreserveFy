import React, { useState, useEffect } from "react";
import  loadingSvg  from "./assets/tube-spinner.svg";
import webmVideo from "./assets/ok.webm"
import githubSvg from "./assets/github-mark-white.svg"
import logo from "./assets/logo.svg"
import placeholder from "./assets/placeholder.jpg"
import CryptoJS from "crypto-js"

function App() {
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [tracksPerPlaylists, setTracksPerPlaylists] = useState([]);
  const [likedTracks, setLikedTracks] = useState([]);
  const [importedData, setImportedData] = useState([]);
  const [checked, setChecked] = useState([]);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showImportInput, setShowImportInput] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hidePlaceHolder,setHidePlaceHolder] = useState(false);

  const encryptionKey = import.meta.env.VITE_HASH;
  const clientId = import.meta.env.VITE_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_CLIENT_SECRET;
  const redirectUri = import.meta.env.VITE_URL;

  const redirectToSpotify = () => {
    const scopes = 'playlist-read-private playlist-modify-public playlist-modify-private user-library-read user-library-modify ugc-image-upload';
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    window.location.href = authUrl;
  };

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      fetchAccessToken(code);
    }
  }, []);

  useEffect(()=>{
    getPlaylists()
  },[token])

  const fetchAccessToken = async (code) => {
    const tokenUrl = 'https://accounts.spotify.com/api/token';
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString(),
    });

    const data = await response.json();
    setToken(data.access_token);

    const idUrl = 'https://api.spotify.com/v1/me';
    const fetchUser = await fetch(idUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + data.access_token,
      }
    });
    const user = await fetchUser.json();
    setUserId(user.id);
  };

  async function getPlaylists () {
    const playlistUrl = `https://api.spotify.com/v1/users/${userId}/playlists`;
    const fetchPlaylists = await fetch(playlistUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
      }
    });
    const result = await fetchPlaylists.json();
    const playlistsArray = result.items;
    setPlaylists(playlistsArray.map(item => ({
      playlist_id: item.id,
      name: item.name,
      public: item.public,
      collaborative: item.collaborative,
      description: item.description,
      images: item.images
    })));  
  };

  async function getTracks () {
    const playlistContent = [];
    for (const playlist of playlists) {
      if (checked.includes(playlist.playlist_id)){
        const tracksUrl = `https://api.spotify.com/v1/playlists/${playlist.playlist_id}/tracks`;
        const fetchTracks = await fetch(tracksUrl, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + token,
          },
        });

        const result = await fetchTracks.json();
        const tracks = result.items.map(track => track.track.uri);

        playlistContent.push({
          playlist_id: playlist.playlist_id,
          name: playlist.name,
          public: playlist.public,
          collaborative: playlist.collaborative,
          description: playlist.description,
          images: playlist.images,
          tracks
        });

        setTracksPerPlaylists(old => [...old, {
          playlist_id: playlist.playlist_id,
          name: playlist.name,
          public: playlist.public,
          collaborative: playlist.collaborative,
          description: playlist.description,
          images: playlist.images,
          tracks
        }]);


        setProgress((prevProgress) => prevProgress + (100 / checked.length));
      }
    } 
    return playlistContent;
  };

  const downloadJSON = (data, filename = 'data.json') => {
    // Convert the data to a JSON string
    const jsonStr = JSON.stringify(data, null, 2);
    
    // Encrypt the JSON string
    const encrypted = CryptoJS.AES.encrypt(jsonStr, encryptionKey).toString();
  
    // Create a Blob and download the file
    const blob = new Blob([encrypted], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
  
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getImportedData = (e) => {
    const file = e.dataTransfer.files[0];
  
    if (file) {
      const reader = new FileReader();
  
      reader.onload = async (e) => {
        try {
          const encryptedData = e.target.result;
  
          // Decrypt the JSON string
          const bytes = CryptoJS.AES.decrypt(encryptedData, encryptionKey);
          const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  
          // Parse the decrypted JSON string
          const jsonData = JSON.parse(decrypted);
          setImportedData(jsonData);
        } catch (error) {
          console.error('Error decrypting JSON:', error);
        }
      };
  
      reader.onerror = () => {
        console.error('Error reading file:', reader.error);
      };
  
      reader.readAsText(file);
      setShowImportInput(false);
    }
  };
  

  async function getLiked () {
    const likedUrl = "https://api.spotify.com/v1/me/tracks?limit=50";
    const fetchLiked = await fetch(likedUrl, {
      method: "GET",
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });

    const result = await fetchLiked.json();
    setLikedTracks(result.items.map(track => track.track.id));
    setProgress((prevProgress) => prevProgress + (100 /checked.length));

    return result.items.map(track => track.track.id);
  };

  const importPlaylist = async () => {
    setProgress(0)
    for (const playlist of importedData.Playlists) {
      if(checked.includes(playlist.playlist_id)){
        const createPlaylistUrl = `https://api.spotify.com/v1/users/${userId}/playlists`;

        const fetchCreatePlaylist = await fetch(createPlaylistUrl, {
          method: "POST",
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: playlist.name,
            public: playlist.public,
            collaborative: playlist.collaborative,
            description: playlist.description
          })
        });
        
        const newPlaylist = await fetchCreatePlaylist.json();

        if (playlist.images.length!=3) {
          const response = await fetch(playlist.images[0].url);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64data = reader.result.split(',')[1];
            console.log(base64data)
            const addImageUrl = 'https://api.spotify.com/v1/playlists/'+newPlaylist.id+'/images'
            const fetchAddImage = await fetch(addImageUrl, {
              method: "PUT",
              headers : {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'image/jpeg'
              },
              body : base64data
            })
          };
        }

        const addTracksUrl = `https://api.spotify.com/v1/playlists/${newPlaylist.id}/tracks`;
        const fetchAddTracks = await fetch(addTracksUrl, {
          method: "POST",
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            uris: playlist.tracks,
          })
        });

        const result = await fetchAddTracks.json();
        setProgress((prevProgress) => prevProgress + (100 / checked.length));
      }
    }
  };

  const importLiked = async () =>{
      if (checked.includes("Liked Songs")){
        const likedTracks = importedData.Liked;
        const reversedArray = [...likedTracks].reverse();
        for (const i of reversedArray) {
          const setLikedUrl = "https://api.spotify.com/v1/me/tracks?ids=" + i;

          const fetchSetLiked = await fetch(setLikedUrl, {
            method: "PUT",
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json'
            },
          });
          setProgress((prevProgress) => prevProgress + ((100/checked.length) /likedTracks.length));
          await sleep(1000);
        }

    }
  };

  const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  const toggleChecked = (playlistName) => {
    if (checked.includes(playlistName)) {
      setChecked(checked.filter(name => name !== playlistName));
    } else {
      setChecked([...checked, playlistName]);
    }
  };

  async function exportData () {
    setIsLoading(true);
    setProgress(0);
    const Playlists = await getTracks();
    if (checked.includes("Liked Songs")) {
      const Liked = await getLiked();
      downloadJSON({Playlists, Liked}, "export.json");
    } else {
      const Liked = [];
      downloadJSON({Playlists, Liked}, "export.json");
    }
    
  }

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    getImportedData(e)
  }

 async function importData(){
  setIsLoading(true)
    await importPlaylist();
    await importLiked();
  }

  return (
    <div className="page" >
      <h3 className="title" > <img style={{width:"50px"}} src={logo}/>reserveFy</h3>
      {!showExport && !showImport && (
        <div className="container exportWindow description" >
          <p>
            <strong style={{color:"#1DB954"}} > PreserveFy</strong> is your ultimate tool for backing up Spotify accounts, ensuring your playlists and liked tracks are securely saved and easily recoverable. Share your backup file with friends, allowing them to effortlessly import and enjoy your curated music collections. Never worry about losing your favorite music again with our seamless backup and sharing service.
          </p>
        </div>
      )}
      {!token && (
        <div style={{display:"flex", alignItems:"center", justifyContent:"center"}} >
          <input className="connextionBtn" type="button" value="Connect to Spotify" onClick={redirectToSpotify} />
        </div>
      )}
      {token && (
        <>  
          {showExport && (
            <>
              <div className="exportWindow">
                <h3>select what you want to back up </h3>
                <div className="container">
                  {playlists.map((playlist) => (
                    <div className="playlist" key={playlist.playlist_id} onClick={() => {toggleChecked(playlist.playlist_id)}} >
                      {!hidePlaceHolder && (
                        <img className="img" src={placeholder} />
                      )}

                        <div className="img">
                          {playlist.images.length==3 && (
                            <img src={playlist.images[1]?.url} alt="playlist image" onLoad={()=>setHidePlaceHolder(true)} style={{ display: hidePlaceHolder ? 'block' : 'none' }} />
                          )}

                          {playlist.images.length!==3 && (
                            <img src={playlist.images[0]?.url} alt="playlist image" onLoad={()=>setHidePlaceHolder(true)} style={{ display: hidePlaceHolder ? 'block' : 'none' }} />
                          )}
                        </div>
                
                      <div className="textes">
                        <span className="name">{playlist.name}</span>
                        <span>playlist</span>
                      </div>
                      <div className="checked">
                        {checked.includes(playlist.playlist_id) && (
                          <svg height="30px" width="30px" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                            <g id="SVGRepo_iconCarrier">
                              <g>
                                <g id="check_x5F_alt">
                                  <path style={{ fill: '#1DB954' }} d="M16,0C7.164,0,0,7.164,0,16s7.164,16,16,16s16-7.164,16-16S24.836,0,16,0z M13.52,23.383 L6.158,16.02l2.828-2.828l4.533,4.535l9.617-9.617l2.828,2.828L13.52,23.383z"></path>
                                </g>
                              </g>
                            </g>
                          </svg>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="liked playlist" onClick={() => {toggleChecked("Liked Songs")}} >
                    <div className="img">
                      <img src="https://i.scdn.co/image/ab67706c0000da8470d229cb865e8d81cdce0889" alt="liked image" />
                    </div>
                    <div className="textes">
                        <span className="name">Liked Songs</span>
                        <span>playlist</span>
                      </div>
                    <div className="checked">
                      {checked.includes("Liked Songs") && (
                        <svg height="30px" width="30px" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                          <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                          <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                          <g id="SVGRepo_iconCarrier">
                            <g>
                              <g id="check_x5F_alt">
                                <path style={{ fill: '#1DB954' }} d="M16,0C7.164,0,0,7.164,0,16s7.164,16,16,16s16-7.164,16-16S24.836,0,16,0z M13.52,23.383 L6.158,16.02l2.828-2.828l4.533,4.535l9.617-9.617l2.828,2.828L13.52,23.383z"></path>
                              </g>
                            </g>
                          </g>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bottomDiv">
                  <input className="connextionBtn" type="button" value="Go back" onClick={()=>{setIsLoading(false);setShowExport(false);setChecked([])}} />
                  {checked.length>0 && (
                    <input className="connextionBtn" type="button" value="Export" onClick={() => exportData()} />
                  )}
                </div>
                {isLoading && (
                  <div className="loading">
                      
                        <span>Exporting... {Math.round(progress)}%</span>
                        {Math.round(progress)!==100 && (
                        <img src={loadingSvg}  />
                        )}
                      
                    
                    {Math.round(progress)==100 && (
                      < >
                        <video autoPlay  muted>
        <source src={webmVideo} type="video/webm" />
        Your browser does not support the video tag.
      </video>
                        <span>The Export has finished</span>
              <input className="connextionBtn" type="button" value="Go back" onClick={()=>{setIsLoading(false);setShowExport(false);setChecked([])}} />
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {showImport && (
            <>
              <div className="exportWindow">
              {(Object.keys(importedData).length>0) && (<h3>select what you want to import </h3>)}
                <div className="container">
                  {showImportInput && (
                    <label>
                    <div  onDragOver={handleDragOver} onDrop={handleDrop} style={{ border: '2px dashed gray', padding: '20px', textAlign: 'center' }}>
                      <p>Drag and drop a file here, or click to select a file</p>
                      <input 
                        type="file" 
                        onChange={(e) =>{ e.preventDefault();getImportedData({ dataTransfer: { files: e.target.files } })}} 
                        style={{ display: 'none' }} 
                      />
                    </div>
                  </label>
                  )}
                  {(Object.keys(importedData).length>0) && (
                    <>
                      {importedData.Playlists.map((playlist) => (
                    <div className="playlist" key={playlist.playlist_id} onClick={() => {toggleChecked(playlist.playlist_id)}} >
                      {!hidePlaceHolder && (
                        <img className="img" src={placeholder} />
                      )}

                        <div className="img">
                          {playlist.images.length==3 && (
                            <img src={playlist.images[1]?.url} alt="playlist image" onLoad={()=>setHidePlaceHolder(true)} style={{ display: hidePlaceHolder ? 'block' : 'none' }} />
                          )}

                          {playlist.images.length!==3 && (
                            <img src={playlist.images[0]?.url} alt="playlist image" onLoad={()=>setHidePlaceHolder(true)} style={{ display: hidePlaceHolder ? 'block' : 'none' }} />
                          )}
                        </div>
                      <div className="textes">
                        <span className="name">{playlist.name}</span>
                        <span>playlist</span>
                      </div>
                      <div className="checked">
                        {checked.includes(playlist.playlist_id) && (
                          <svg height="30px" width="30px" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                            <g id="SVGRepo_iconCarrier">
                              <g>
                                <g id="check_x5F_alt">
                                  <path style={{ fill: '#1DB954' }} d="M16,0C7.164,0,0,7.164,0,16s7.164,16,16,16s16-7.164,16-16S24.836,0,16,0z M13.52,23.383 L6.158,16.02l2.828-2.828l4.533,4.535l9.617-9.617l2.828,2.828L13.52,23.383z"></path>
                                </g>
                              </g>
                            </g>
                          </svg>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="liked playlist" onClick={() => {toggleChecked("Liked Songs")}} >
                    <div className="img">
                      <img src="https://i.scdn.co/image/ab67706c0000da8470d229cb865e8d81cdce0889" alt="liked image" />
                    </div>
                    <div className="textes">
                        <span className="name">Liked Songs</span>
                        <span>playlist</span>
                      </div>
                    <div className="checked">
                      {checked.includes("Liked Songs") && (
                        <svg height="30px" width="30px" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                          <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                          <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                          <g id="SVGRepo_iconCarrier">
                            <g>
                              <g id="check_x5F_alt">
                                <path style={{ fill: '#1DB954' }} d="M16,0C7.164,0,0,7.164,0,16s7.164,16,16,16s16-7.164,16-16S24.836,0,16,0z M13.52,23.383 L6.158,16.02l2.828-2.828l4.533,4.535l9.617-9.617l2.828,2.828L13.52,23.383z"></path>
                              </g>
                            </g>
                          </g>
                        </svg>
                      )}
                    </div>
                  </div>
                    </>
                  )}

                </div>
                <div className="bottomDiv">
                  <input className="connextionBtn" type="button" value="Go back" onClick={()=>{setIsLoading(false);setShowImport(false);setChecked([]);setHidePlaceHolder(false);setImportedData([]);setShowImportInput(true)}} />
                  {checked.length>0 && (
                    <input className="connextionBtn" type="button" value="Import" onClick={() => importData()} />
                  )}
                </div>
                {isLoading && (
                  <div className="loading">
                    
                      
                        <span>Importing... {Math.round(progress)}%</span>
                        {Math.round(progress)!==100 && (
                        <img src={loadingSvg}  />
                        )}
                      
                    
                    {Math.round(progress)==100 && (
                      <>
                        <video autoPlay  muted>
        <source src={webmVideo} type="video/webm" />
        Your browser does not support the video tag.
      </video>
                        <span>The Import has finished</span>
              <input className="connextionBtn" type="button" value="Go back" onClick={()=>{setIsLoading(false);setShowImport(false);setChecked([]);setHidePlaceHolder(false)}} />
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {((!showExport) && (!showImport)) && (
            <div style={{display:"flex", alignItems:"center",gap:"10px"}} >
              <input className="connextionBtn" type="button" value="Import" onClick={()=>{setShowImport(true);setShowExport(false)}} />
              <input className="connextionBtn" type="button" value="Export" onClick={() =>{ setShowExport(true);setShowImport(false)}} />
            </div>    
          )}
          </>
      )}

      <footer style={{display:"flex",justifyContent:"center",alignItems:"center",gap:"10%",bottom:"0",position:"absolute",left:"0",right:"0",margin:"0 0 10px 0"}} >
        <span>Made by AIT TALEB Massinissa</span>
        <a style={{display:"flex",alignItems:"center",gap:"5px",color:"white",textDecoration:"none"}} href="https://github.com/Ait-taleb-massinissa/PreserveFy">
          <img src={githubSvg} style={{width:"20px",height:"20px",margin:"0",padding:"0"}} />
          <span style={{fontSize:"20px"}} >GitHub</span>
        </a>

      </footer>
    </div>
  );
}

export default App;
