#include <array>
#include <iostream>
#include <string>
#include <vector>
using namespace std;
constexpr int W=10,H=20;
using Board=array<array<char,W>,H>;
bool collides(const Board& b,const vector<vector<int>>& m,int x,int y){
 for(int r=0;r<(int)m.size();++r)for(int c=0;c<(int)m[r].size();++c)if(m[r][c]){
  int xx=x+c,yy=y+r;if(xx<0||xx>=W||yy>=H||(yy>=0&&b[yy][xx]!=' '))return true;
 }return false;
}
int clearLines(Board& b){
 int cleared=0;for(int r=H-1;r>=0;--r){bool full=true;for(char c:b[r])if(c==' ')full=false;
  if(full){++cleared;for(int y=r;y>0;--y)b[y]=b[y-1];b[0].fill(' ');++r;}
 }return cleared;
}
int main(){
 Board b;for(auto& row:b)row.fill(' ');
 cout<<"Pastel Tetris core C++17\\n";cout<<"This file demonstrates collision and line-clear logic.\\n";
 cout<<"Board size: "<<W<<" x "<<H<<"\\n";
 b[H-1].fill('#');int n=clearLines(b);
 cout<<"Demo: cleared "<<n<<" line(s).\\n";
 cout<<"Integrate this core with your preferred renderer/input system.\\n";
 return 0;
}
